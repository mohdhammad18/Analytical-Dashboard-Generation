import json
import logging
import numpy as np
import pandas as pd
from typing import TypedDict, List, Dict, Any, Optional
from openai import OpenAI
from langgraph.graph import StateGraph, END

from src.core.llm import llm_invoke
from .utils import get_supabase_client, execute_raw_sql, OPENAI_API_KEY

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
_openai_client = OpenAI(api_key=OPENAI_API_KEY)


def _embed(texts: List[str]) -> np.ndarray:
    """Embed a list of strings using OpenAI and return an (N, D) float32 array."""
    response = _openai_client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    vectors = [item.embedding for item in response.data]
    return np.array(vectors, dtype=np.float32)

# --- State Definition ---
class GraphState(TypedDict):
    query: str
    retrieved_tables: List[Dict[str, Any]]
    table_name: Optional[str]
    sql_query: Optional[str]
    explanation: Optional[str]
    limit: Optional[int]
    error: Optional[str]
    retry_count: int
    results: Optional[List[Dict[str, Any]]]

# --- Components ---

class MetadataRetriever:
    def __init__(self):
        logger.info("MetadataRetriever: loading table metadata from Supabase")
        client = get_supabase_client()
        response = client.table("table_metadata").select("*").execute()
        self.df = pd.DataFrame(response.data)
        self.text_rows = [
            f"{row.table_name} {row.table_description} {row.data_description}"
            for row in self.df.itertuples()
        ]
        logger.info("MetadataRetriever: embedding %d rows with OpenAI", len(self.text_rows))
        self.embeddings = _embed(self.text_rows)
        logger.debug("MetadataRetriever: embeddings shape=%s", self.embeddings.shape)

    def retrieve(self, query: str, k: int = 3) -> List[Dict[str, Any]]:
        logger.debug("MetadataRetriever.retrieve | query_preview=%.80r k=%d", query, k)
        query_vec = _embed([query])
        norms_corpus = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        norms_query = np.linalg.norm(query_vec, axis=1, keepdims=True)
        corpus_normed = self.embeddings / np.maximum(norms_corpus, 1e-10)
        query_normed = query_vec / np.maximum(norms_query, 1e-10)
        sims = (query_normed @ corpus_normed.T)[0]
        top_idx = np.argsort(sims)[::-1][:k]
        results = self.df.iloc[top_idx]
        top_tables = results["table_name"].tolist()
        logger.info("MetadataRetriever.retrieve | top_tables=%s", top_tables)
        return results[["table_name", "table_description", "data_description"]].to_dict('records')

class SQLGenerator:
    def generate(self, prompt: str, retrieved_tables: List[Dict[str, Any]], error: Optional[str] = None) -> Dict[str, Any]:
        tables_str = json.dumps(retrieved_tables, indent=2)

        system_prompt = f"""You are an expert PostgreSQL assistant.
You must ONLY use the following retrieved tables to construct your query:
{tables_str}

### SQL STRATEGY & GUIDELINES:
1. **EXACT COLUMN NAMES**: The `data_description` field lists the EXACT column names and types. Use these column names VERBATIM in your SQL. Do NOT invent, guess, or paraphrase column names. For example if the metadata says `total_created (int)`, use `total_created` — NOT "Total Created items" or "total_created_items".
2. **Type Safety**: If you are performing arithmetic (+, -, *, /) on columns that might be stored as TEXT (like durations 'HH:MM:SS'), you MUST cast them.
3. **Durations**: Columns ending in '_duration' often contain strings like 'HH:MM:SS'. To sum or compare them, cast to interval or extract seconds.
   - Example: `(SPLIT_PART(col, ':', 1)::INT * 3600 + SPLIT_PART(col, ':', 2)::INT * 60 + SPLIT_PART(col, ':', 3)::INT)` to get total seconds.
4. **Casting**: Use `::NUMERIC` or `::INT` for any column you intend to use in a math expression if its type is not explicitly numeric.
5. **Aliases**: Always use descriptive aliases for calculated columns.
6. **No Hallucinations**: Only use the tables and column names provided in the metadata above. Never infer or fabricate column names.
7. **Aggregations**: If you query a table that groups data by multiple dimensions (e.g., channel and user), and the user only asks for one dimension (e.g., channel), you MUST use `SUM()` or appropriate aggregation functions and `GROUP BY` that specific dimension. This ensures each unique dimension value only appears once in the results.
8. **RESERVED KEYWORDS**: If a column name is a reserved PostgreSQL word (like `user`), you MUST enclose it in double quotes: `"user"`. Failure to do this will result in system variables being returned (e.g. `USER` returns the database user 'postgres').

Your output MUST be a JSON object with:
- "table_name": (string) The name of the table to query.
- "sql_query": (string) The PostgreSQL query with explicit type casting.
- "explanation": (string) Brief reasoning.
- "limit": (integer or null) Row limit requested by user.

Output raw JSON ONLY."""

        if error:
            system_prompt += (
                f"\n\nCRITICAL: PREVIOUS QUERY FAILED. Error: {error}\n"
                "Refine your query. Ensure you cast TEXT columns to NUMERIC before math operations."
            )

        raw = llm_invoke(
            system=system_prompt,
            user=prompt,
            json_mode=True,
            temperature=0.0,
        )
        parsed = json.loads(raw)
        logger.info(
            "SQLGenerator.generate | table=%s sql_preview=%.120r",
            parsed.get("table_name"), parsed.get("sql_query", "")[:120],
        )
        return parsed

class SQLExecutor:
    def execute(self, query: str) -> List[Dict[str, Any]]:
        return execute_raw_sql(query)

# --- Pipeline Orchestrator ---

class Text2SQLPipeline:
    def __init__(self):
        self.retriever = MetadataRetriever()
        self.generator = SQLGenerator()
        self.executor = SQLExecutor()
        
        # Build and compile graph
        self.app = self._build_graph()

    def _build_graph(self):
        builder = StateGraph(GraphState)
        
        # Add Nodes
        builder.add_node("retrieve", self._retrieve_node)
        builder.add_node("generate", self._generate_node)
        builder.add_node("execute", self._execute_node)

        # Build Flow
        builder.set_entry_point("retrieve")
        builder.add_edge("retrieve", "generate")
        builder.add_edge("generate", "execute")
        builder.add_conditional_edges(
            "execute", 
            self._route_execution, 
            {"generate": "generate", END: END}
        )

        return builder.compile()

    # --- Node Callbacks ---

    def _retrieve_node(self, state: GraphState) -> Dict[str, Any]:
        logger.info("Graph[retrieve] | query_preview=%.80r", state["query"])
        tables = self.retriever.retrieve(state["query"], k=3)
        return {"retrieved_tables": tables}

    def _generate_node(self, state: GraphState) -> Dict[str, Any]:
        retry = state["retry_count"]
        logger.info("Graph[generate] | retry=%d has_error=%s", retry, bool(state.get("error")))
        result = self.generator.generate(state["query"], state["retrieved_tables"], state.get("error"))
        return {
            "table_name": result.get("table_name"),
            "sql_query": result.get("sql_query"),
            "explanation": result.get("explanation"),
            "limit": result.get("limit"),
            "error": None,
        }

    def _execute_node(self, state: GraphState) -> Dict[str, Any]:
        logger.info("Graph[execute] | sql_preview=%.120r", (state.get("sql_query") or "")[:120])
        try:
            results = self.executor.execute(state["sql_query"])
            limit_val = state.get("limit")
            if limit_val and isinstance(limit_val, int):
                results = results[:limit_val]
            logger.info("Graph[execute] ok | rows=%d", len(results))
            return {"results": results, "error": None}
        except Exception as e:
            logger.warning("Graph[execute] failed | error=%s", e)
            return {"error": str(e), "retry_count": state["retry_count"] + 1}

    def _route_execution(self, state: GraphState) -> str:
        if state.get("error") and state["retry_count"] < 5:
            return "generate"
        return END

    def run(self, query: str):
        """Invoke the LangGraph pipeline."""
        return self.app.invoke({"query": query, "retry_count": 0})

def run_pipeline(query: str):
    """Convenience function for backward compatibility."""
    pipeline = Text2SQLPipeline()
    return pipeline.run(query)


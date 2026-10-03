"""
Shared LLM factory.

Reads USE_OPENAI / GROQ_MODEL / OPENAI_MODEL from config and returns
the appropriate LangChain chat model (ChatGroq or ChatOpenAI).

Usage:
    from src.core.llm import llm_invoke, llm_chat

    # Simple single-turn call
    text = llm_invoke(system="You are helpful.", user="What is 2+2?")

    # Multi-turn conversation with history
    text = llm_chat(system="...", history=[{"role": "user", "content": "Hi"}], user_text="How are you?")
"""

import logging
from typing import Any
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage

from src.core.config import settings

logger = logging.getLogger(__name__)


def _is_openai() -> bool:
    val = settings.USE_OPENAI.strip().lower()
    return val in ("true", "1", "yes")


def get_llm(temperature: float = 0.0, json_mode: bool = False) -> Any:
    """
    Return a configured LangChain chat model instance.

    Args:
        temperature: Sampling temperature (0 = deterministic).
        json_mode:   If True, enable JSON response format (both providers support this).
    """
    model_kwargs: dict = {}
    if json_mode:
        model_kwargs["response_format"] = {"type": "json_object"}

    if _is_openai():
        model = settings.OPENAI_MODEL or "gpt-4o-mini"
        logger.debug("Building ChatOpenAI | model=%s temperature=%s json_mode=%s", model, temperature, json_mode)
        return ChatOpenAI(
            model=model,
            api_key=settings.OPENAI_API_KEY,
            temperature=temperature,
            model_kwargs=model_kwargs,
        )
    else:
        model = settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        logger.debug("Building ChatGroq | model=%s temperature=%s json_mode=%s", model, temperature, json_mode)
        return ChatGroq(
            model=model,
            api_key=settings.GROQ_API_KEY,
            temperature=temperature,
            model_kwargs=model_kwargs,
        )


def llm_invoke(
    system: str,
    user: str,
    json_mode: bool = False,
    temperature: float = 0.0,
) -> str:
    """
    Single-turn LLM call: system prompt + one user message.
    Returns the assistant's reply as a plain string.
    """
    provider = "openai" if _is_openai() else "groq"
    logger.info("llm_invoke | provider=%s json_mode=%s user_preview=%.80r", provider, json_mode, user)
    llm = get_llm(temperature=temperature, json_mode=json_mode)
    messages: list[BaseMessage] = [
        SystemMessage(content=system),
        HumanMessage(content=user),
    ]
    content = llm.invoke(messages).content  # type: ignore[return-value]
    logger.debug("llm_invoke response | preview=%.120r", content)
    return content


def llm_chat(
    system: str,
    history: list[dict],
    user_text: str,
    temperature: float = 0.7,
) -> str:
    """
    Multi-turn LLM call with conversation history.

    Args:
        system:    System prompt string.
        history:   List of past messages: [{"role": "user"|"assistant", "content": "..."}]
        user_text: The new user message to append.

    Returns:
        Assistant reply as a plain string.
    """
    provider = "openai" if _is_openai() else "groq"
    logger.info(
        "llm_chat | provider=%s history_len=%d user_preview=%.80r",
        provider, len(history), user_text,
    )
    llm = get_llm(temperature=temperature)

    messages: list[BaseMessage] = [SystemMessage(content=system)]
    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "assistant":
            messages.append(AIMessage(content=content))
        else:
            messages.append(HumanMessage(content=content))
    messages.append(HumanMessage(content=user_text))

    content = llm.invoke(messages).content  # type: ignore[return-value]
    logger.debug("llm_chat response | preview=%.120r", content)
    return content

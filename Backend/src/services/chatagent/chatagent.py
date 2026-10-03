import logging
from typing import List

from src.core.llm import llm_chat

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = "You are a helpful, knowledgeable, and concise AI assistant."


class ChatAgent:
    """
    Stateless chat agent. Delegates to the active LLM provider (Groq or OpenAI)
    via the shared llm_chat factory — controlled by USE_OPENAI in .env.
    """

    def __init__(self, system_prompt: str = DEFAULT_SYSTEM_PROMPT, temperature: float = 0.7):
        self.system_prompt = system_prompt
        self.temperature = temperature
        logger.debug("ChatAgent initialised | temperature=%s", temperature)

    def chat(self, messages: List[dict], text: str) -> str:
        """
        Send a message with conversation history and return the assistant's reply.

        Args:
            messages: Past messages as [{"role": "user"|"assistant", "content": "..."}]
            text:     The new user message.
        """
        logger.info("ChatAgent.chat | history_len=%d user_preview=%.80r", len(messages), text)
        reply = llm_chat(
            system=self.system_prompt,
            history=messages,
            user_text=text,
            temperature=self.temperature,
        )
        logger.debug("ChatAgent reply | preview=%.120r", reply)
        return reply


chat_agent = ChatAgent()

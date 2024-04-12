from typing import Any

from sentry.llm.providers.base import LlmModelBase


class PreviewLLM(LlmModelBase):
    """
    A dummy LLM provider that does not actually send any requests to any LLM API.
    """

    provider_name = "preview"

    def _complete_prompt(
        self,
        usecase_options: dict[str, Any],
        prompt: str,
        message: str,
        temperature: float = 0.7,
        max_output_tokens: int = 1000,
    ) -> str | None:
        return ""

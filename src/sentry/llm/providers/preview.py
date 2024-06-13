from sentry.llm.providers.base import LlmModelBase
from sentry.llm.types import UseCaseConfig


class PreviewLLM(LlmModelBase):
    """
    A dummy LLM provider that does not actually send any requests to any LLM API.
    """

    provider_name = "preview"

    def _complete_prompt(
        self,
        *,
        usecase_config: UseCaseConfig,
        prompt: str | None = None,
        message: str,
        temperature: float = 0.7,
        max_output_tokens: int = 1000,
    ) -> str | None:
        return ""

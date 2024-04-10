from typing import Any

from sentry.llm.providers.base import LlmModelBase
from sentry.llm.types import UseCaseProviderOptions


class PreviewLLM(LlmModelBase):
    def __init__(self, **options: dict[str, Any]) -> None:
        pass

    def complete_prompt(
        self,
        usecase_options: UseCaseProviderOptions,
        prompt: str,
        message: str,
        temperature: float = 0.7,
        max_output_tokens: int = 1000,
    ) -> str | None:
        return ""

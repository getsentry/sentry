from sentry.llm.types import ProviderOptions, UseCaseProviderOptions
from sentry.utils.services import Service


class LlmModelBase(Service):
    def __init__(self, options: ProviderOptions) -> None:
        self.options = options

    def complete_prompt(
        self,
        usecase_options: UseCaseProviderOptions,
        prompt: str,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:
        raise NotImplementedError

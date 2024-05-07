from sentry.llm.exceptions import InvalidModelError, InvalidProviderError
from sentry.llm.types import ProviderConfig, UseCaseConfig
from sentry.utils.services import Service


class LlmModelBase(Service):
    def __init__(self, provider_config: ProviderConfig) -> None:
        self.provider_config = provider_config

    def complete_prompt(
        self,
        *,
        usecase_config: UseCaseConfig,
        prompt: str | None = None,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:
        self.validate_model(usecase_config["options"]["model"])

        return self._complete_prompt(
            usecase_config=usecase_config,
            prompt=prompt,
            message=message,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

    def _complete_prompt(
        self,
        *,
        usecase_config: UseCaseConfig,
        prompt: str | None = None,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:
        raise NotImplementedError

    def validate_model(self, model_name: str) -> None:
        if "models" not in self.provider_config:
            raise InvalidProviderError(f"No models defined for provider {self.__class__.__name__}")

        if model_name not in self.provider_config["models"]:
            raise InvalidModelError(f"Invalid model: {model_name}")

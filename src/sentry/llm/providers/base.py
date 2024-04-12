from typing import Any

from sentry.utils.services import Service


class LlmModelBase(Service):

    provider_name: str

    def __init__(self, **options: Any) -> None:
        self.options = options

    def complete_prompt(
        self,
        usecase_options: dict[str, Any],
        prompt: str,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:
        self.validate_model(usecase_options["options"]["model"])

        return self._complete_prompt(
            usecase_options, prompt, message, temperature, max_output_tokens
        )

    def _complete_prompt(
        self,
        usecase_options: dict[str, Any],
        prompt: str,
        message: str,
        temperature: float,
        max_output_tokens: int,
    ) -> str | None:
        raise NotImplementedError

    def get_provider_options(self) -> dict[str, Any]:
        return self.options[self.provider_name]["options"]

    def get_provider_models(self) -> list[str]:

        if self.provider_name not in self.options:
            raise ValueError(f"Invalid provider config for {self.provider_name}")

        if "models" not in self.options[self.provider_name]:
            raise ValueError(f"No models defined for provider {self.provider_name}")

        return self.options[self.provider_name]["models"]

    def validate_model(self, model_name: str) -> None:
        if model_name not in self.get_provider_models():
            raise ValueError(f"Invalid model: {model_name}")

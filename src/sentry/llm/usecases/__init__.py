from enum import Enum

from sentry import options
from sentry.llm.exceptions import InvalidProviderError, InvalidTemperature, InvalidUsecaseError
from sentry.llm.providers.base import LlmModelBase
from sentry.llm.providers.openai import OpenAIProvider
from sentry.llm.providers.preview import PreviewLLM
from sentry.llm.providers.vertex import VertexProvider
from sentry.llm.types import ProviderConfig, UseCaseConfig

SENTRY_LLM_SERVICE_ALIASES = {
    "vertex": VertexProvider,
    "openai": OpenAIProvider,
    "preview": PreviewLLM,
}


class LLMUseCase(Enum):
    EXAMPLE = "example"  # used in tests / examples
    SUGGESTED_FIX = "suggestedfix"  # OG version of suggested fix
    SPAM_DETECTION = "spamdetection"


llm_provider_backends: dict[str, LlmModelBase] = {}


def get_llm_provider_backend(usecase: LLMUseCase) -> LlmModelBase:
    usecase_config = get_usecase_config(usecase.value)
    global llm_provider_backends

    if usecase_config["provider"] in llm_provider_backends:
        return llm_provider_backends[usecase_config["provider"]]

    if usecase_config["provider"] not in SENTRY_LLM_SERVICE_ALIASES:
        raise InvalidProviderError(f"LLM provider {usecase_config['provider']} not found")

    provider = SENTRY_LLM_SERVICE_ALIASES[usecase_config["provider"]]

    provider_config = get_provider_config(usecase_config["provider"])

    llm_provider_backends[usecase_config["provider"]] = provider(
        provider_config,
    )

    return llm_provider_backends[usecase_config["provider"]]


def complete_prompt(
    *,
    usecase: LLMUseCase,
    prompt: str | None = None,
    message: str,
    temperature: float = 0.5,
    max_output_tokens: int = 1000,
) -> str | None:
    """
    :param usecase: The usecase to use. see LLMUseCase
    :param prompt: The prompt to complete.
    prompt is the system message, it holds a special role in most LLM models and is treated differently.
    It's optional and not required, only the initial user message is.
    :param message: The message to complete the prompt with, generally the input that differs between calls
    :param temperature: The temperature to use. Defaults to 0.5.
    :param max_output_tokens: The maximum number of output tokens. Defaults to 1000.
    :return: The completed prompt.
    Complete a prompt with a message using the specified usecase.
    Default temperature and max_output_tokens set to a hopefully
    reasonable value, but please consider what makes sense for
    your specific use case.

    Note that temperature should be between 0 and 1, and we will
    normalize to any providers who have a different range
    """
    _validate_temperature(temperature)

    usecase_config = get_usecase_config(usecase.value)

    backend = get_llm_provider_backend(usecase)
    return backend.complete_prompt(
        usecase_config=usecase_config,
        prompt=prompt,
        message=message,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )


def get_usecase_config(usecase: str) -> UseCaseConfig:
    usecase_options_all = options.get("llm.usecases.options")
    if not usecase_options_all:
        raise InvalidUsecaseError(
            "LLM usecase options not found. please check llm.usecases.options"
        )

    if usecase not in usecase_options_all:
        raise InvalidUsecaseError(
            f"LLM usecase options not found for {usecase}. please check llm.usecases.options"
        )

    return usecase_options_all[usecase]


def get_provider_config(provider: str) -> ProviderConfig:
    llm_provider_options_all = options.get("llm.provider.options")
    if not llm_provider_options_all:
        raise InvalidProviderError("LLM provider option value not found")
    if provider not in llm_provider_options_all:
        raise InvalidProviderError(f"LLM provider {provider} not found")
    return llm_provider_options_all[provider]


def _validate_temperature(temperature: float) -> None:
    if not (0 <= temperature <= 1):
        raise InvalidTemperature("Temperature must be between 0 and 1")

from enum import Enum

from sentry import options
from sentry.llm.providers.base import LlmModelBase
from sentry.llm.types import ModelLiterals, ProviderOptions, UseCaseOptions
from sentry.utils.services import LazyServiceWrapper

SENTRY_LLM_SERVICE_ALIASES: dict[ModelLiterals, str] = {
    "vertex": "sentry.llm.providers.vertex.VertexProvider",
    "openai": "sentry.llm.providers.openai.OpenAIProvider",
    "preview": "sentry.llm.providers.preview.PreviewLLM",
}


class LlmUseCase(Enum):
    SUGGESTED_FIX = "suggestedfix"


def complete_prompt(
    usecase: LlmUseCase, prompt: str, message: str, temperature: float, max_output_tokens: int
) -> str | None:
    usecase_config: UseCaseOptions = get_usecase_options(usecase)
    provider_config: ProviderOptions = get_provider_options()

    provider = usecase_config[usecase.value]["provider"]

    backend = LazyServiceWrapper(
        LlmModelBase,
        SENTRY_LLM_SERVICE_ALIASES[provider],
        provider_config,
    )
    return backend.complete_prompt(
        usecase_config[usecase.value], prompt, message, temperature, max_output_tokens
    )


def get_usecase_options(usecase: LlmUseCase) -> UseCaseOptions:
    usecase_options_all: UseCaseOptions = options.get("llm.usecases.options")
    if not usecase_options_all:
        raise ValueError("LLM usecase options not found")

    return usecase_options_all


def get_provider_options() -> ProviderOptions:
    llm_provider_option: ProviderOptions = options.get("llm.provider.options")
    if not llm_provider_option:
        raise ValueError("LLM provider option not found")
    return llm_provider_option

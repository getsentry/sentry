from enum import Enum

from sentry import options
from sentry.llm.exceptions import InvalidProviderError, InvalidUsecaseError
from sentry.llm.providers.base import LlmModelBase
from sentry.utils.services import LazyServiceWrapper

SENTRY_LLM_SERVICE_ALIASES = {
    "vertex": "sentry.llm.providers.vertex.VertexProvider",
    "openai": "sentry.llm.providers.openai.OpenAIProvider",
    "preview": "sentry.llm.providers.preview.PreviewLLM",
}


class LlmUseCase(Enum):
    EXAMPLE = "example"  # used in tests / examples
    SUGGESTED_FIX = "suggestedfix"  # OG version of suggested fix


llm_provider_backends: dict[str, LlmModelBase] = {}


def get_llm_provider_backend(usecase: LlmUseCase) -> LlmModelBase:
    usecase_config = get_usecase_config(usecase.value)
    provider_config = get_provider_config(usecase_config["provider"])
    global llm_provider_backends

    if usecase_config["provider"] in llm_provider_backends:
        return llm_provider_backends[usecase_config["provider"]]

    if usecase_config["provider"] not in SENTRY_LLM_SERVICE_ALIASES:
        raise InvalidProviderError(f"LLM provider {usecase_config['provider']} not found")

    llm_provider_backends[usecase_config["provider"]] = LazyServiceWrapper(
        LlmModelBase,
        SENTRY_LLM_SERVICE_ALIASES[usecase_config["provider"]],
        provider_config,
    )
    return llm_provider_backends[usecase_config["provider"]]


def complete_prompt(
    *,
    usecase: LlmUseCase,
    prompt: str,
    message: str,
    temperature: float = 0.5,
    max_output_tokens: int = 1000,
) -> str | None:
    """
    Complete a prompt with a message using the specified usecase.
    Default temperature and max_output_tokens set to a hopefully
    reasonable value, but please consider what makes sense for
    your specific use case.
    """
    usecase_config = get_usecase_config(usecase.value)

    backend = get_llm_provider_backend(usecase)
    return backend.complete_prompt(
        usecase_config=usecase_config,
        prompt=prompt,
        message=message,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )


def get_usecase_config(usecase: str):
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


def get_provider_config(provider: str):
    llm_provider_options_all = options.get("llm.provider.options")
    if not llm_provider_options_all:
        raise InvalidProviderError("LLM provider option value not found")
    if provider not in llm_provider_options_all:
        raise InvalidProviderError(f"LLM provider {provider} not found")
    return llm_provider_options_all[provider]

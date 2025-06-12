from sentry.api.exceptions import ParameterValidationError
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils.providers import get_provider_enum


def validate_provider(
    provider: str,
    available_providers: set[ExternalProviders] | None = None,
    context: list[str] | None = None,
) -> ExternalProviders:
    provider_option = get_provider_enum(provider)
    if not provider_option:
        raise ParameterValidationError(f"Unknown provider: {provider}", context)

    # If not available_providers are provider, assume all are acceptable
    if available_providers and provider_option not in available_providers:
        raise ParameterValidationError(
            f'The provider "{provider}" is not supported. We currently accept {available_providers} identities.'
        )
    return provider_option

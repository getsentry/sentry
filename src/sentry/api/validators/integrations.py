from typing import List, Optional, Set

from sentry.api.exceptions import ParameterValidationError
from sentry.types.integrations import ExternalProviders, get_provider_enum


def validate_provider(
    provider: str,
    available_providers: Optional[Set[ExternalProviders]] = None,
    context: Optional[List[str]] = None,
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


def validate_provider_option(provider: Optional[str]) -> Optional[ExternalProviders]:
    return validate_provider(provider) if provider else None

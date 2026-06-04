from collections.abc import Sequence

from sentry.integrations.errors import InvalidProviderException
from sentry.integrations.types import (
    EXTERNAL_PROVIDERS,
    PERSONAL_NOTIFICATION_PROVIDERS,
    ExternalProviders,
)

_UNKNOWN_PROVIDER = "unknown"


def get_provider_name(value: int) -> str | None:
    return EXTERNAL_PROVIDERS.get(ExternalProviders(value), None)


def get_provider_string(provider_int: int) -> str:
    return get_provider_name(provider_int) or _UNKNOWN_PROVIDER


def get_provider_enum(value: str | None) -> ExternalProviders | None:
    if value is None:
        return None
    return {v: k for k, v in EXTERNAL_PROVIDERS.items()}.get(value, None)


def get_provider_choices(providers: set[ExternalProviders]) -> Sequence[str]:
    return list(EXTERNAL_PROVIDERS[i] for i in providers if i in EXTERNAL_PROVIDERS)


def get_provider_enum_from_string(provider: str) -> ExternalProviders:
    for k, v in EXTERNAL_PROVIDERS.items():
        if v == provider:
            return k
    raise InvalidProviderException(f"Invalid provider {provider}")


PERSONAL_NOTIFICATION_PROVIDERS_AS_INT = [
    get_provider_enum_from_string(provider_name).value
    for provider_name in PERSONAL_NOTIFICATION_PROVIDERS
]

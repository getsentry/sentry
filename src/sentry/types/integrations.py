from enum import Enum
from typing import Optional


class ExternalProviders(Enum):
    GITHUB = 0
    GITLAB = 1
    EMAIL = 100
    SLACK = 110


EXTERNAL_PROVIDERS = {
    ExternalProviders.GITHUB: "github",
    ExternalProviders.GITLAB: "gitlab",
    ExternalProviders.EMAIL: "email",
    ExternalProviders.SLACK: "slack",
}


def get_provider_name(value: int) -> Optional[str]:
    return EXTERNAL_PROVIDERS.get(ExternalProviders(value))


def get_provider_string(provider_int: int) -> str:
    return get_provider_name(provider_int) or "unknown"


def get_provider_enum(value: Optional[str]) -> Optional[ExternalProviders]:
    return {v: k for k, v in EXTERNAL_PROVIDERS.items()}.get(value)


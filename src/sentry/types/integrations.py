from enum import Enum
from typing import Optional, Sequence, Set


class ExternalProviders(Enum):
    UNUSED_GH = 0
    UNUSED_GL = 1

    EMAIL = 100
    SLACK = 110
    MSTEAMS = 120
    PAGERDUTY = 130
    GITHUB = 200
    GITLAB = 210

    CUSTOM = 700


EXTERNAL_PROVIDERS = {
    ExternalProviders.EMAIL: "email",
    ExternalProviders.SLACK: "slack",
    ExternalProviders.MSTEAMS: "msteams",
    ExternalProviders.PAGERDUTY: "pagerduty",
    ExternalProviders.GITHUB: "github",
    ExternalProviders.GITLAB: "gitlab",
    ExternalProviders.CUSTOM: "custom_scm",
}


def get_provider_name(value: int) -> Optional[str]:
    return EXTERNAL_PROVIDERS.get(ExternalProviders(value))


def get_provider_string(provider_int: int) -> str:
    return get_provider_name(provider_int) or "unknown"


def get_provider_enum(value: Optional[str]) -> Optional[ExternalProviders]:
    return {v: k for k, v in EXTERNAL_PROVIDERS.items()}.get(value)


def get_provider_choices(providers: Set[ExternalProviders]) -> Sequence[str]:
    return list(EXTERNAL_PROVIDERS.get(i) for i in providers)

from enum import Enum
from typing import Optional, Sequence, Set

from sentry.services.hybrid_cloud import ValueEqualityEnum


class ExternalProviders(ValueEqualityEnum):
    UNUSED_GH = 0
    UNUSED_GL = 1

    EMAIL = 100
    SLACK = 110
    MSTEAMS = 120
    PAGERDUTY = 130
    DISCORD = 140
    OPSGENIE = 150
    GITHUB = 200
    GITHUB_ENTERPRISE = 201
    GITLAB = 210

    # TODO: do migration to delete this from database
    CUSTOM = 700

    @property
    def name(self) -> Optional[str]:
        return get_provider_name(self.value)


class ExternalProviderEnum(Enum):
    EMAIL = "email"
    SLACK = "slack"
    MSTEAMS = "msteams"
    PAGERDUTY = "pagerduty"
    DISCORD = "discord"
    OPSGENIE = "opsgenie"
    GITHUB = "github"
    GITHUB_ENTERPRISE = "github_enterprise"
    GITLAB = "gitlab"
    CUSTOM = "custom_scm"


EXTERNAL_PROVIDERS_REVERSE = {
    ExternalProviderEnum.EMAIL: ExternalProviders.EMAIL,
    ExternalProviderEnum.SLACK: ExternalProviders.SLACK,
    ExternalProviderEnum.MSTEAMS: ExternalProviders.MSTEAMS,
    ExternalProviderEnum.PAGERDUTY: ExternalProviders.PAGERDUTY,
    ExternalProviderEnum.DISCORD: ExternalProviders.DISCORD,
    ExternalProviderEnum.OPSGENIE: ExternalProviders.OPSGENIE,
    ExternalProviderEnum.GITHUB: ExternalProviders.GITHUB,
    ExternalProviderEnum.GITHUB_ENTERPRISE: ExternalProviders.GITHUB_ENTERPRISE,
    ExternalProviderEnum.GITLAB: ExternalProviders.GITLAB,
    ExternalProviderEnum.CUSTOM: ExternalProviders.CUSTOM,
}

EXTERNAL_PROVIDERS = {
    ExternalProviders.EMAIL: ExternalProviderEnum.EMAIL.value,
    ExternalProviders.SLACK: ExternalProviderEnum.SLACK.value,
    ExternalProviders.MSTEAMS: ExternalProviderEnum.MSTEAMS.value,
    ExternalProviders.PAGERDUTY: ExternalProviderEnum.PAGERDUTY.value,
    ExternalProviders.DISCORD: ExternalProviderEnum.DISCORD.value,
    ExternalProviders.OPSGENIE: ExternalProviderEnum.OPSGENIE.value,
    ExternalProviders.GITHUB: ExternalProviderEnum.GITHUB.value,
    ExternalProviders.GITHUB_ENTERPRISE: ExternalProviderEnum.GITHUB_ENTERPRISE.value,
    ExternalProviders.GITLAB: ExternalProviderEnum.GITLAB.value,
    ExternalProviders.CUSTOM: ExternalProviderEnum.CUSTOM.value,
}

# the list of providers allowed for personal notifications
PERSONAL_NOTIFICATION_PROVIDERS = [
    ExternalProviderEnum.EMAIL.value,
    ExternalProviderEnum.SLACK.value,
    ExternalProviderEnum.MSTEAMS.value,
]


def get_provider_name(value: int) -> Optional[str]:
    return EXTERNAL_PROVIDERS.get(ExternalProviders(value))


def get_provider_string(provider_int: int) -> str:
    return get_provider_name(provider_int) or "unknown"


def get_provider_enum(value: Optional[str]) -> Optional[ExternalProviders]:
    return {v: k for k, v in EXTERNAL_PROVIDERS.items()}.get(value)


def get_provider_choices(providers: Set[ExternalProviders]) -> Sequence[str]:
    return list(EXTERNAL_PROVIDERS.get(i) for i in providers)


def get_provider_enum_from_string(provider: str) -> ExternalProviders:
    for k, v in EXTERNAL_PROVIDERS.items():
        if v == provider:
            return k
    raise InvalidProviderException("Invalid provider ${provider}")


PERSONAL_NOTIFICATION_PROVIDERS_AS_INT = [
    get_provider_enum_from_string(provider_name).value
    for provider_name in PERSONAL_NOTIFICATION_PROVIDERS
]


class InvalidProviderException(Exception):
    pass

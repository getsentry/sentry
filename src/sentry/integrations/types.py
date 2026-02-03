from dataclasses import dataclass
from enum import Enum, StrEnum
from typing import Generic, TypeVar

from sentry.hybridcloud.rpc import ValueEqualityEnum


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
    JIRA_SERVER = 300
    PERFORCE = 400

    # TODO: do migration to delete this from database
    CUSTOM = 700

    @property
    def name(self) -> str:
        return EXTERNAL_PROVIDERS.get(ExternalProviders(self.value), "")


class IntegrationProviderSlug(StrEnum):
    SLACK = "slack"
    DISCORD = "discord"
    MSTEAMS = "msteams"
    JIRA = "jira"
    JIRA_SERVER = "jira_server"
    AZURE_DEVOPS = "vsts"
    GITHUB = "github"
    GITHUB_ENTERPRISE = "github_enterprise"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"
    BITBUCKET_SERVER = "bitbucket_server"
    PAGERDUTY = "pagerduty"
    OPSGENIE = "opsgenie"
    PERFORCE = "perforce"


class DataForwarderProviderSlug(StrEnum):
    SEGMENT = "segment"
    SQS = "sqs"
    SPLUNK = "splunk"


class ExternalProviderEnum(StrEnum):
    EMAIL = "email"
    CUSTOM = "custom_scm"
    SLACK = IntegrationProviderSlug.SLACK
    MSTEAMS = IntegrationProviderSlug.MSTEAMS
    PAGERDUTY = IntegrationProviderSlug.PAGERDUTY
    DISCORD = IntegrationProviderSlug.DISCORD
    OPSGENIE = IntegrationProviderSlug.OPSGENIE
    GITHUB = IntegrationProviderSlug.GITHUB
    GITHUB_ENTERPRISE = IntegrationProviderSlug.GITHUB_ENTERPRISE
    GITLAB = IntegrationProviderSlug.GITLAB
    JIRA_SERVER = IntegrationProviderSlug.JIRA_SERVER
    PERFORCE = IntegrationProviderSlug.PERFORCE


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
    ExternalProviderEnum.PERFORCE: ExternalProviders.PERFORCE,
    ExternalProviderEnum.CUSTOM: ExternalProviders.CUSTOM,
}

EXTERNAL_PROVIDERS_REVERSE_VALUES = {k.value: v for k, v in EXTERNAL_PROVIDERS_REVERSE.items()}

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
    ExternalProviders.JIRA_SERVER: ExternalProviderEnum.JIRA_SERVER.value,
    ExternalProviders.PERFORCE: ExternalProviderEnum.PERFORCE.value,
    ExternalProviders.CUSTOM: ExternalProviderEnum.CUSTOM.value,
}

PERSONAL_NOTIFICATION_PROVIDERS = [
    ExternalProviderEnum.EMAIL.value,
    ExternalProviderEnum.SLACK.value,
    ExternalProviderEnum.MSTEAMS.value,
]


class EventLifecycleOutcome(Enum):
    STARTED = "STARTED"
    HALTED = "HALTED"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"

    def __str__(self) -> str:
        return self.value.lower()


T = TypeVar("T")


@dataclass
class IntegrationResponse(Generic[T]):
    interaction_result: EventLifecycleOutcome
    response: T
    outcome_reason: str | Exception | None = None
    context_data: dict | None = None

from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum, StrEnum
from typing import Annotated, Generic, Literal, NotRequired, TypedDict, TypeVar

from sentry.apidocs.descriptions import ApiDescription
from sentry.hybridcloud.rpc import ValueEqualityEnum

# A text, select, multi-select or boolean field's value. Null when nothing is preselected.
IntegrationIssueConfigFieldValue = str | int | bool | list[str] | None


class IntegrationIssueConfigField(TypedDict):
    """JSON form field returned by an issue integration."""

    name: Annotated[str, ApiDescription("Name of the form field")]
    label: Annotated[str, ApiDescription("Label of the form field")]
    type: Annotated[
        str, ApiDescription("Type of the form field, such as string, text, select or boolean")
    ]
    default: NotRequired[
        Annotated[IntegrationIssueConfigFieldValue, ApiDescription("Default value of the field")]
    ]
    defaultValue: NotRequired[
        Annotated[
            IntegrationIssueConfigFieldValue,
            ApiDescription("Default value of the field, for integrations that use this key"),
        ]
    ]
    required: NotRequired[Annotated[bool, ApiDescription("Whether the field is required")]]
    choices: NotRequired[
        Annotated[
            Sequence[tuple[str | int, str]],
            ApiDescription("Options of a select field, as [value, label] pairs"),
        ]
    ]
    url: NotRequired[
        Annotated[str, ApiDescription("URL that returns the field's options as the user types")]
    ]
    updatesForm: NotRequired[
        Annotated[bool, ApiDescription("Whether changing the field reloads the form")]
    ]
    multiple: NotRequired[
        Annotated[bool, ApiDescription("Whether the field accepts more than one value")]
    ]
    autosize: NotRequired[
        Annotated[bool, ApiDescription("Whether a text field grows with its content")]
    ]
    maxRows: NotRequired[Annotated[int, ApiDescription("Maximum number of rows of a text field")]]
    maxLength: NotRequired[Annotated[int, ApiDescription("Maximum length of the value")]]
    help: NotRequired[Annotated[str, ApiDescription("Help text of the field")]]
    placeholder: NotRequired[Annotated[str, ApiDescription("Placeholder of the field")]]
    prefetch: NotRequired[
        Annotated[bool, ApiDescription("Whether the field's options load before the user types")]
    ]
    dependsOn: NotRequired[
        Annotated[
            Sequence[str],
            ApiDescription("Names of the fields whose values the field's options depend on"),
        ]
    ]


class ExternalProviders(ValueEqualityEnum):
    UNUSED_GH = 0
    UNUSED_GL = 1

    EMAIL = 100
    SLACK = 110
    SLACK_STAGING = 111
    MSTEAMS = 120
    PAGERDUTY = 130
    DISCORD = 140
    OPSGENIE = 150
    GITHUB = 200
    GITHUB_ENTERPRISE = 201
    GITLAB = 210
    CURSOR_ORIGIN = 211
    JIRA_SERVER = 300
    PERFORCE = 400

    # TODO: do migration to delete this from database
    CUSTOM = 700

    @property
    def name(self) -> str:
        return EXTERNAL_PROVIDERS.get(ExternalProviders(self.value), "")


class IntegrationProviderSlug(StrEnum):
    SLACK = "slack"
    SLACK_STAGING = "slack_staging"
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
    CURSOR_ORIGIN = "cursor_origin"
    PAGERDUTY = "pagerduty"
    OPSGENIE = "opsgenie"
    PERFORCE = "perforce"
    DATADOG = "datadog"
    DATADOG_PAT = "datadog_pat"
    GCP = "gcp"
    GRAFANA = "grafana"


MONITORING_PROVIDERS: frozenset[str] = frozenset(
    {
        IntegrationProviderSlug.DATADOG,
        IntegrationProviderSlug.DATADOG_PAT,
        IntegrationProviderSlug.GCP,
    }
)


class DataForwarderProviderSlug(StrEnum):
    SEGMENT = "segment"
    SQS = "sqs"
    SPLUNK = "splunk"


class ExternalProviderEnum(StrEnum):
    EMAIL = "email"
    CUSTOM = "custom_scm"
    SLACK = IntegrationProviderSlug.SLACK
    SLACK_STAGING = IntegrationProviderSlug.SLACK_STAGING
    MSTEAMS = IntegrationProviderSlug.MSTEAMS
    PAGERDUTY = IntegrationProviderSlug.PAGERDUTY
    DISCORD = IntegrationProviderSlug.DISCORD
    OPSGENIE = IntegrationProviderSlug.OPSGENIE
    GITHUB = IntegrationProviderSlug.GITHUB
    GITHUB_ENTERPRISE = IntegrationProviderSlug.GITHUB_ENTERPRISE
    GITLAB = IntegrationProviderSlug.GITLAB
    CURSOR_ORIGIN = IntegrationProviderSlug.CURSOR_ORIGIN
    JIRA_SERVER = IntegrationProviderSlug.JIRA_SERVER
    PERFORCE = IntegrationProviderSlug.PERFORCE


EXTERNAL_PROVIDERS_REVERSE = {
    ExternalProviderEnum.EMAIL: ExternalProviders.EMAIL,
    ExternalProviderEnum.SLACK: ExternalProviders.SLACK,
    ExternalProviderEnum.SLACK_STAGING: ExternalProviders.SLACK_STAGING,
    ExternalProviderEnum.MSTEAMS: ExternalProviders.MSTEAMS,
    ExternalProviderEnum.PAGERDUTY: ExternalProviders.PAGERDUTY,
    ExternalProviderEnum.DISCORD: ExternalProviders.DISCORD,
    ExternalProviderEnum.OPSGENIE: ExternalProviders.OPSGENIE,
    ExternalProviderEnum.GITHUB: ExternalProviders.GITHUB,
    ExternalProviderEnum.GITHUB_ENTERPRISE: ExternalProviders.GITHUB_ENTERPRISE,
    ExternalProviderEnum.GITLAB: ExternalProviders.GITLAB,
    ExternalProviderEnum.CURSOR_ORIGIN: ExternalProviders.CURSOR_ORIGIN,
    ExternalProviderEnum.PERFORCE: ExternalProviders.PERFORCE,
    ExternalProviderEnum.CUSTOM: ExternalProviders.CUSTOM,
}

EXTERNAL_PROVIDERS_REVERSE_VALUES = {k.value: v for k, v in EXTERNAL_PROVIDERS_REVERSE.items()}

EXTERNAL_PROVIDERS = {
    ExternalProviders.EMAIL: ExternalProviderEnum.EMAIL.value,
    ExternalProviders.SLACK: ExternalProviderEnum.SLACK.value,
    ExternalProviders.SLACK_STAGING: ExternalProviderEnum.SLACK_STAGING.value,
    ExternalProviders.MSTEAMS: ExternalProviderEnum.MSTEAMS.value,
    ExternalProviders.PAGERDUTY: ExternalProviderEnum.PAGERDUTY.value,
    ExternalProviders.DISCORD: ExternalProviderEnum.DISCORD.value,
    ExternalProviders.OPSGENIE: ExternalProviderEnum.OPSGENIE.value,
    ExternalProviders.GITHUB: ExternalProviderEnum.GITHUB.value,
    ExternalProviders.GITHUB_ENTERPRISE: ExternalProviderEnum.GITHUB_ENTERPRISE.value,
    ExternalProviders.GITLAB: ExternalProviderEnum.GITLAB.value,
    ExternalProviders.CURSOR_ORIGIN: ExternalProviderEnum.CURSOR_ORIGIN.value,
    ExternalProviders.JIRA_SERVER: ExternalProviderEnum.JIRA_SERVER.value,
    ExternalProviders.PERFORCE: ExternalProviderEnum.PERFORCE.value,
    ExternalProviders.CUSTOM: ExternalProviderEnum.CUSTOM.value,
}

PERSONAL_NOTIFICATION_PROVIDERS = [
    ExternalProviderEnum.EMAIL.value,
    ExternalProviderEnum.SLACK.value,
    ExternalProviderEnum.SLACK_STAGING.value,
    ExternalProviderEnum.MSTEAMS.value,
]


class ExternalActorSource(ValueEqualityEnum):
    """How an ExternalActor row was created. New values can be added here
    without a database migration (the column is a plain integer)."""

    MANUAL = 0
    IDENTITY = 1
    COMMIT_AUTHOR = 2
    SCM_API = 3

    @classmethod
    def as_choices(cls) -> tuple[tuple[int, str], ...]:
        return tuple((e.value, e._name_.lower()) for e in cls)


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
    context_data: dict[str, object] | None = None


HaltReason = Literal[
    "configuration_error",
    "connection_reset",
    "host_timeout",
    "host_unreachable",
    "identity_not_found",
    "identity_not_valid",
    "installation_suspended",
    "rate_limited",
    "too_many_redirects",
    "unauthorized",
    "unsupported_response",
]

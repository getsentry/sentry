import dataclasses
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, IntEnum, StrEnum
from typing import Any, ClassVar, NotRequired, TypedDict

import sentry_sdk
from django.apps.registry import Apps
from django.db import migrations, router, transaction
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    translate_to_data_condition,
)

logger = logging.getLogger(__name__)


class SkipMigratingException(Exception):
    pass


SKIPPED_CONDITIONS = ["every_event"]

# COPY PASTES FOR RULE REGISTRY

SENTRY_RULES = {
    "sentry.rules.conditions.every_event.EveryEventCondition": "condition/event",
    "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition": "condition/event",
    "sentry.rules.conditions.regression_event.RegressionEventCondition": "condition/event",
    "sentry.rules.conditions.reappeared_event.ReappearedEventCondition": "condition/event",
    "sentry.rules.conditions.new_high_priority_issue.NewHighPriorityIssueCondition": "condition/event",
    "sentry.rules.conditions.existing_high_priority_issue.ExistingHighPriorityIssueCondition": "condition/event",
    "sentry.rules.conditions.tagged_event.TaggedEventCondition": "condition/event",
    "sentry.rules.conditions.event_frequency.EventFrequencyCondition": "condition/event",
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition": "condition/event",
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions": "condition/event",
    "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition": "condition/event",
    "sentry.rules.conditions.event_attribute.EventAttributeCondition": "condition/event",
    "sentry.rules.conditions.level.LevelCondition": "condition/event",
    "sentry.rules.filters.age_comparison.AgeComparisonFilter": "filter/event",
    "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter": "filter/event",
    "sentry.rules.filters.assigned_to.AssignedToFilter": "filter/event",
    "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter": "filter/event",
    "sentry.rules.filters.latest_release.LatestReleaseFilter": "filter/event",
    "sentry.rules.filters.issue_category.IssueCategoryFilter": "filter/event",
    # The following filters are duplicates of their respective conditions and are conditionally shown if the user has issue alert-filters
    "sentry.rules.filters.event_attribute.EventAttributeFilter": "filter/event",
    "sentry.rules.filters.tagged_event.TaggedEventFilter": "filter/event",
    "sentry.rules.filters.level.LevelFilter": "filter/event",
}


def split_conditions_and_filters(
    rule_condition_list,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    condition_list = []
    filter_list = []
    for rule_cond in rule_condition_list:
        if SENTRY_RULES.get(rule_cond["id"]) == "condition/event":
            condition_list.append(rule_cond)
        else:
            filter_list.append(rule_cond)

    return condition_list, filter_list


class MatchType(StrEnum):
    CONTAINS = "co"
    ENDS_WITH = "ew"
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    GREATER = "gt"
    IS_SET = "is"
    IS_IN = "in"
    LESS_OR_EQUAL = "lte"
    LESS = "lt"
    NOT_CONTAINS = "nc"
    NOT_ENDS_WITH = "new"
    NOT_EQUAL = "ne"
    NOT_SET = "ns"
    NOT_STARTS_WITH = "nsw"
    NOT_IN = "nin"
    STARTS_WITH = "sw"


# COPY PASTES FOR DATACONDITIONGROUP
class DataConditionGroupType(StrEnum):
    # ANY will evaluate all conditions, and return true if any of those are met
    ANY = "any"

    # ANY_SHORT_CIRCUIT will stop evaluating conditions as soon as one is met
    ANY_SHORT_CIRCUIT = "any-short"

    # ALL will evaluate all conditions, and return true if all of those are met
    ALL = "all"

    # NONE will return true if none of the conditions are met, will return false immediately if any are met
    NONE = "none"


# COPY PASTES FOR ACTIONS

OPSGENIE_DEFAULT_PRIORITY = "P3"
PAGERDUTY_DEFAULT_SEVERITY = "default"


class ActionTarget(IntEnum):
    SPECIFIC = 0
    USER = 1
    TEAM = 2
    SENTRY_APP = 3
    ISSUE_OWNERS = 4


class ActionTargetType(Enum):
    ISSUE_OWNERS = "IssueOwners"
    TEAM = "Team"
    MEMBER = "Member"


class FallthroughChoiceType(Enum):
    ALL_MEMBERS = "AllMembers"
    ACTIVE_MEMBERS = "ActiveMembers"
    NO_ONE = "NoOne"


# Keep existing excluded keys constant
EXCLUDED_ACTION_DATA_KEYS = ["uuid", "id"]


class SentryAppIdentifier(StrEnum):
    """
    SentryAppIdentifier is an enum that represents the identifier for a Sentry app.
    """

    SENTRY_APP_INSTALLATION_UUID = "sentry_app_installation_uuid"
    SENTRY_APP_SLUG = "sentry_app_slug"
    SENTRY_APP_ID = "sentry_app_id"


class ActionType(StrEnum):
    SLACK = "slack"
    MSTEAMS = "msteams"
    DISCORD = "discord"

    PAGERDUTY = "pagerduty"
    OPSGENIE = "opsgenie"

    GITHUB = "github"
    GITHUB_ENTERPRISE = "github_enterprise"
    JIRA = "jira"
    JIRA_SERVER = "jira_server"
    AZURE_DEVOPS = "azure_devops"

    EMAIL = "email"
    SENTRY_APP = "sentry_app"

    PLUGIN = "plugin"
    WEBHOOK = "webhook"


@dataclass
class FieldMapping:
    """
    FieldMapping is a class that represents the mapping of a target field to a source field.
    """

    source_field: str
    default_value: Any = None


class ActionFieldMappingKeys(StrEnum):
    """
    ActionFieldMappingKeys is an enum that represents the keys of an action field mapping.
    """

    INTEGRATION_ID_KEY = "integration_id_key"
    TARGET_IDENTIFIER_KEY = "target_identifier_key"
    TARGET_DISPLAY_KEY = "target_display_key"


class TicketFieldMappingKeys(StrEnum):
    """
    TicketFieldMappingKeys is an enum that represents the keys of a ticket field mapping.
    """

    DYNAMIC_FORM_FIELDS_KEY = "dynamic_form_fields"
    ADDITIONAL_FIELDS_KEY = "additional_fields"


class EmailFieldMappingKeys(StrEnum):
    """
    EmailFieldMappingKeys is an enum that represents the keys of an email field mapping.
    """

    FALLTHROUGH_TYPE_KEY = "fallthroughType"
    TARGET_TYPE_KEY = "targetType"


class ActionFieldMapping(TypedDict):
    """Mapping between Action model fields and Rule Action blob fields"""

    id: str
    integration_id_key: NotRequired[str]
    target_identifier_key: NotRequired[str]
    target_display_key: NotRequired[str]


ACTION_FIELD_MAPPINGS: dict[str, ActionFieldMapping] = {
    ActionType.SLACK: ActionFieldMapping(
        id="sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
        integration_id_key="workspace",
        target_identifier_key="channel_id",
        target_display_key="channel",
    ),
    ActionType.DISCORD: ActionFieldMapping(
        id="sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
        integration_id_key="server",
        target_identifier_key="channel_id",
    ),
    ActionType.MSTEAMS: ActionFieldMapping(
        id="sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
        integration_id_key="team",
        target_identifier_key="channel_id",
        target_display_key="channel",
    ),
    ActionType.PAGERDUTY: ActionFieldMapping(
        id="sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
        integration_id_key="account",
        target_identifier_key="service",
    ),
    ActionType.OPSGENIE: ActionFieldMapping(
        id="sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
        integration_id_key="account",
        target_identifier_key="team",
    ),
    ActionType.GITHUB: ActionFieldMapping(
        id="sentry.integrations.github.notify_action.GitHubCreateTicketAction",
        integration_id_key="integration",
    ),
    ActionType.GITHUB_ENTERPRISE: ActionFieldMapping(
        id="sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
        integration_id_key="integration",
    ),
    ActionType.AZURE_DEVOPS: ActionFieldMapping(
        id="sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
        integration_id_key="integration",
    ),
    ActionType.JIRA: ActionFieldMapping(
        id="sentry.integrations.jira.notify_action.JiraCreateTicketAction",
        integration_id_key="integration",
    ),
    ActionType.JIRA_SERVER: ActionFieldMapping(
        id="sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
        integration_id_key="integration",
    ),
    ActionType.EMAIL: ActionFieldMapping(
        id="sentry.mail.actions.NotifyEmailAction",
        target_identifier_key="targetIdentifier",
    ),
    ActionType.PLUGIN: ActionFieldMapping(
        id="sentry.rules.actions.notify_event.NotifyEventAction",
    ),
    ActionType.WEBHOOK: ActionFieldMapping(
        id="sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        target_identifier_key="service",
    ),
    ActionType.SENTRY_APP: ActionFieldMapping(
        id="sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
        target_identifier_key="sentryAppInstallationUuid",
    ),
}


@dataclass
class DataBlob:
    """DataBlob is a generic type that represents the data blob for a notification action."""

    pass


@dataclass
class SlackDataBlob(DataBlob):
    """
    SlackDataBlob is a specific type that represents the data blob for a Slack notification action.
    """

    tags: str = ""
    notes: str = ""


@dataclass
class DiscordDataBlob(DataBlob):
    """
    DiscordDataBlob is a specific type that represents the data blob for a Discord notification action.
    """

    tags: str = ""


@dataclass
class OnCallDataBlob(DataBlob):
    """
    OnCallDataBlob is a specific type that represents the data blob for a PagerDuty or Opsgenie notification action.
    """

    priority: str = ""


@dataclass
class TicketDataBlob(DataBlob):
    """
    TicketDataBlob is a specific type that represents the data blob for a ticket creation action.
    """

    # Dynamic form fields from customer configuration
    dynamic_form_fields: list[dict] = field(default_factory=list)
    # Store any additional fields that aren't part of standard fields
    additional_fields: dict[str, Any] = field(default_factory=dict)


@dataclass
class SentryAppFormConfigDataBlob(DataBlob):
    """
    SentryAppFormConfigDataBlob represents a single form config field for a Sentry App.
    name is the name of the form field, and value is the value of the form field.
    """

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SentryAppFormConfigDataBlob":
        if not isinstance(data.get("name"), str) or not isinstance(
            data.get("value"), (str, type(None))
        ):
            raise ValueError("Sentry app config must contain name and value keys")
        return cls(name=data["name"], value=data["value"], label=data.get("label"))

    name: str = ""
    value: str | None = ""
    label: str | None = None


@dataclass
class SentryAppDataBlob(DataBlob):
    """
    Represents a Sentry App notification action.
    """

    settings: list[SentryAppFormConfigDataBlob] = field(default_factory=list)

    @classmethod
    def from_list(cls, data: list[dict[str, Any]] | None) -> "SentryAppDataBlob":
        if data is None:
            return cls()
        return cls(settings=[SentryAppFormConfigDataBlob.from_dict(setting) for setting in data])


@dataclass
class EmailDataBlob(DataBlob):
    """
    EmailDataBlob represents the data blob for an email notification action.
    """

    fallthroughType: str = ""


class BaseActionTranslator(ABC):
    @property
    @abstractmethod
    def action_type(self) -> ActionType:
        pass

    # Represents the mapping of a target field to a source field {target_field: FieldMapping}
    field_mappings: ClassVar[dict[str, FieldMapping]] = {}

    def __init__(self, action: dict[str, Any]):
        self.action = action

    @property
    @abstractmethod
    def required_fields(self) -> list[str]:
        """Return the required fields for this action"""
        pass

    @property
    def missing_fields(self) -> list[str]:
        """Return the missing fields for this action"""
        return [field for field in self.required_fields if self.action.get(field) is None]

    @property
    @abstractmethod
    def target_type(self) -> int | None:
        """Return the target type for this action"""
        pass

    @property
    def integration_id(self) -> int | None:
        """Return the integration ID for this action, if any"""
        if mapping := ACTION_FIELD_MAPPINGS.get(self.action_type):
            if ActionFieldMappingKeys.INTEGRATION_ID_KEY.value in mapping:
                return self.action.get(mapping[ActionFieldMappingKeys.INTEGRATION_ID_KEY.value])
        return None

    @property
    def target_identifier(self) -> str | None:
        """Return the target identifier for this action, if any"""
        if mapping := ACTION_FIELD_MAPPINGS.get(self.action_type):
            if ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value in mapping:
                return self.action.get(mapping[ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value])
        return None

    @property
    def target_display(self) -> str | None:
        """Return the display name for the target, if any"""
        if mapping := ACTION_FIELD_MAPPINGS.get(self.action_type):
            if ActionFieldMappingKeys.TARGET_DISPLAY_KEY in mapping:
                return self.action.get(mapping[ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value])
        return None

    @property
    def action_config(self) -> dict[str, str | int | None]:
        base_config = {
            "target_identifier": self.target_identifier,
            "target_display": self.target_display,
            "target_type": self.target_type if self.target_type is not None else None,
        }
        if self.action_type == ActionType.SENTRY_APP:
            base_config["sentry_app_identifier"] = SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID

        return base_config

    @property
    def blob_type(self) -> type[DataBlob] | None:
        """Return the blob type for this action, if any"""
        return None

    def is_valid(self) -> bool:
        """
        Validate that all required fields for this action are present.
        Should be overridden by subclasses to add specific validation.
        """
        return len(self.missing_fields) == 0

    def get_sanitized_data(self) -> dict[str, Any]:
        """
        Return sanitized data for this action
        If a blob type is specified, convert the action data to a dataclass
        Otherwise, remove excluded keys
        """
        if self.blob_type:
            mapped_data = {}
            for field_name in (field.name for field in dataclasses.fields(self.blob_type)):
                mapping = self.field_mappings.get(field_name)
                # If a mapping is specified, use the source field value or default value
                if mapping:
                    source_field = mapping.source_field
                    value = self.action.get(source_field, mapping.default_value)
                # Otherwise, use the field value
                else:
                    value = self.action.get(field_name, "")
                mapped_data[field_name] = value

            blob_instance = self.blob_type(**mapped_data)
            return dataclasses.asdict(blob_instance)
        else:
            # Remove excluded keys and required fields
            excluded_keys = EXCLUDED_ACTION_DATA_KEYS + self.required_fields
            return {k: v for k, v in self.action.items() if k not in excluded_keys}


class SlackActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.SLACK

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[ActionType.SLACK][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[ActionType.SLACK][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[ActionType.SLACK][
                ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value
            ],
        ]

    @property
    def target_type(self) -> int:
        return ActionTarget.SPECIFIC.value

    @property
    def blob_type(self) -> type[DataBlob]:
        return SlackDataBlob


class DiscordActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.DISCORD

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[ActionType.DISCORD][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[ActionType.DISCORD][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
        ]

    @property
    def target_type(self) -> int:
        return ActionTarget.SPECIFIC.value

    @property
    def blob_type(self) -> type[DataBlob]:
        return DiscordDataBlob


class MSTeamsActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.MSTEAMS

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[ActionType.MSTEAMS][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[ActionType.MSTEAMS][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[ActionType.MSTEAMS][
                ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value
            ],
        ]

    @property
    def target_type(self) -> int:
        return ActionTarget.SPECIFIC.value


class PagerDutyActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.PAGERDUTY

    field_mappings = {
        "priority": FieldMapping(
            source_field="severity", default_value=str(PAGERDUTY_DEFAULT_SEVERITY)
        )
    }

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[ActionType.PAGERDUTY][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[ActionType.PAGERDUTY][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
        ]

    @property
    def target_type(self) -> int:
        return ActionTarget.SPECIFIC.value

    @property
    def blob_type(self) -> type[DataBlob]:
        return OnCallDataBlob


class OpsgenieActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.OPSGENIE

    field_mappings = {
        "priority": FieldMapping(
            source_field="priority", default_value=str(OPSGENIE_DEFAULT_PRIORITY)
        )
    }

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[ActionType.OPSGENIE][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[ActionType.OPSGENIE][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
        ]

    @property
    def target_type(self) -> int:
        return ActionTarget.SPECIFIC.value

    @property
    def blob_type(self) -> type[DataBlob]:
        return OnCallDataBlob


class TicketingActionDataBlobHelper(ABC):
    @staticmethod
    def separate_fields(
        data: dict[str, Any], excluded_keys: list[str] | None = None
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """
        Separates data into standard and additional fields.
        Returns tuple of (dynamic_form_fields, additional_fields)
        """
        excluded_keys = excluded_keys or []
        dynamic_form_fields = data.get(TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value, [])

        additional_fields = {
            k: v
            for k, v in data.items()
            if k not in dynamic_form_fields
            and k not in EXCLUDED_ACTION_DATA_KEYS
            and k not in excluded_keys
            and k != TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value
        }
        return dynamic_form_fields, additional_fields


class TicketActionTranslator(BaseActionTranslator, TicketingActionDataBlobHelper, ABC):
    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[self.action_type][ActionFieldMappingKeys.INTEGRATION_ID_KEY.value]
        ]

    @property
    def integration_id(self) -> Any | None:
        return self.action.get("integration")

    @property
    def target_type(self) -> int:
        return ActionTarget.SPECIFIC.value

    @property
    def blob_type(self) -> type[DataBlob]:
        return TicketDataBlob

    def get_sanitized_data(self) -> dict[str, Any]:
        """
        Override to handle custom fields and additional fields that aren't part of the standard fields.
        """
        # Use helper to separate fields, excluding required fields
        dynamic_form_fields, additional_fields = self.separate_fields(
            self.action, excluded_keys=self.required_fields
        )
        data = {
            TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value: dynamic_form_fields,
            TicketFieldMappingKeys.ADDITIONAL_FIELDS_KEY.value: additional_fields,
        }
        return data


class GithubActionTranslator(TicketActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.GITHUB


class GithubEnterpriseActionTranslator(TicketActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.GITHUB_ENTERPRISE


class AzureDevopsActionTranslator(TicketActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.AZURE_DEVOPS


class JiraActionTranslatorBase(TicketActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.JIRA


class JiraServerActionTranslatorBase(TicketActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.JIRA_SERVER


class EmailActionHelper(ABC):
    target_type_mapping = {
        ActionTarget.USER.value: ActionTargetType.MEMBER.value,
        ActionTarget.TEAM.value: ActionTargetType.TEAM.value,
        ActionTarget.ISSUE_OWNERS.value: ActionTargetType.ISSUE_OWNERS.value,
    }

    reverse_target_type_mapping = {v: k for k, v in target_type_mapping.items()}

    @staticmethod
    def get_target_type_object(target_type: str) -> int:
        return EmailActionHelper.reverse_target_type_mapping[target_type]

    @staticmethod
    def get_target_type_string(target_type: int) -> str:
        return EmailActionHelper.target_type_mapping[target_type]


class EmailActionTranslator(BaseActionTranslator, EmailActionHelper):
    @property
    def action_type(self) -> ActionType:
        return ActionType.EMAIL

    @property
    def required_fields(self) -> list[str]:
        return [
            EmailFieldMappingKeys.TARGET_TYPE_KEY.value,
        ]

    @property
    def target_type(self) -> int:
        # If the targetType is Member, then set the target_type to User,
        # if the targetType is Team, then set the target_type to Team,
        # otherwise return None (this would be for IssueOwners (suggested assignees))

        if (target_type := self.action.get(EmailFieldMappingKeys.TARGET_TYPE_KEY.value)) is None:
            raise ValueError("Target type is required for email actions")

        return EmailActionHelper.get_target_type_object(target_type)

    @property
    def target_identifier(self) -> str | None:
        target_type = self.action.get(EmailFieldMappingKeys.TARGET_TYPE_KEY.value)
        if target_type in [ActionTargetType.MEMBER.value, ActionTargetType.TEAM.value]:
            return str(
                self.action.get(
                    ACTION_FIELD_MAPPINGS[ActionType.EMAIL][
                        ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
                    ]
                )
            )
        return None

    @property
    def blob_type(self) -> type[DataBlob] | None:
        target_type = self.action.get(EmailFieldMappingKeys.TARGET_TYPE_KEY.value)
        if target_type == ActionTargetType.ISSUE_OWNERS.value:
            return EmailDataBlob
        return None

    def get_sanitized_data(self) -> dict[str, Any]:
        """
        Override to handle the special case of IssueOwners target type
        """
        if (
            self.action.get(EmailFieldMappingKeys.TARGET_TYPE_KEY.value)
            == ActionTargetType.ISSUE_OWNERS.value
        ):
            return dataclasses.asdict(
                EmailDataBlob(
                    fallthroughType=self.action.get(
                        EmailFieldMappingKeys.FALLTHROUGH_TYPE_KEY.value,
                        FallthroughChoiceType.ACTIVE_MEMBERS.value,
                    ),
                )
            )
        return {}


class PluginActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.PLUGIN

    @property
    def required_fields(self) -> list[str]:
        # NotifyEventAction doesn't appear to have any required fields
        # beyond the standard id and uuid
        return []

    @property
    def target_type(self) -> None:
        # This appears to be a generic plugin notification
        # so we'll use SPECIFIC as the target type
        return None


class WebhookActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.WEBHOOK

    @property
    def target_type(self) -> int | None:
        return None

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[ActionType.WEBHOOK][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ]
        ]


class SentryAppActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> ActionType:
        return ActionType.SENTRY_APP

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[ActionType.SENTRY_APP][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ]
        ]

    @property
    def target_type(self) -> int | None:
        return ActionTarget.SENTRY_APP.value

    def get_sanitized_data(self) -> dict[str, Any]:
        data = SentryAppDataBlob()
        if settings := self.action.get("settings"):
            for setting in settings:
                data.settings.append(SentryAppFormConfigDataBlob(**setting))

        return dataclasses.asdict(data)

    @property
    def blob_type(self) -> type[DataBlob]:
        return SentryAppDataBlob


issue_alert_action_translator_mapping: dict[str, type[BaseActionTranslator]] = {
    ACTION_FIELD_MAPPINGS[ActionType.SLACK]["id"]: SlackActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.DISCORD]["id"]: DiscordActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.MSTEAMS]["id"]: MSTeamsActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.PAGERDUTY]["id"]: PagerDutyActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.OPSGENIE]["id"]: OpsgenieActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.GITHUB]["id"]: GithubActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.GITHUB_ENTERPRISE]["id"]: GithubEnterpriseActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.AZURE_DEVOPS]["id"]: AzureDevopsActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.JIRA]["id"]: JiraActionTranslatorBase,
    ACTION_FIELD_MAPPINGS[ActionType.JIRA_SERVER]["id"]: JiraServerActionTranslatorBase,
    ACTION_FIELD_MAPPINGS[ActionType.EMAIL]["id"]: EmailActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.PLUGIN]["id"]: PluginActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.WEBHOOK]["id"]: WebhookActionTranslator,
    ACTION_FIELD_MAPPINGS[ActionType.SENTRY_APP]["id"]: SentryAppActionTranslator,
}


# MIGRATION STARTS HERE


def migrate_issue_alerts(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    Project = apps.get_model("sentry", "Project")
    Rule = apps.get_model("sentry", "Rule")
    RuleActivity = apps.get_model("sentry", "RuleActivity")
    RuleSnooze = apps.get_model("sentry", "RuleSnooze")
    AlertRuleDetector = apps.get_model("workflow_engine", "AlertRuleDetector")
    AlertRuleWorkflow = apps.get_model("workflow_engine", "AlertRuleWorkflow")
    DataCondition = apps.get_model("workflow_engine", "DataCondition")
    DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")
    DataConditionGroupAction = apps.get_model("workflow_engine", "DataConditionGroupAction")
    Detector = apps.get_model("workflow_engine", "Detector")
    DetectorWorkflow = apps.get_model("workflow_engine", "DetectorWorkflow")
    Workflow = apps.get_model("workflow_engine", "Workflow")
    WorkflowDataConditionGroup = apps.get_model("workflow_engine", "WorkflowDataConditionGroup")
    Action = apps.get_model("workflow_engine", "Action")

    def _translate_rule_data_actions_to_notification_actions(
        actions: list[dict[str, Any]]
    ) -> list[Any]:
        # Skips over invalid actions

        notification_actions: list[Any] = []

        for action in actions:
            # Fetch the registry ID
            registry_id = action.get("id")
            if not registry_id:
                logger.error(
                    "No registry ID found for action",
                    extra={"action_uuid": action.get("uuid")},
                )
                continue

            # Fetch the translator class
            try:
                translator_class = issue_alert_action_translator_mapping[registry_id]
                translator = translator_class(action)
            except KeyError:
                logger.exception(
                    "Action translator not found for action",
                    extra={
                        "registry_id": registry_id,
                        "action_uuid": action.get("uuid"),
                    },
                )
                continue

            # Check if the action is well-formed
            if not translator.is_valid():
                logger.error(
                    "Action blob is malformed: missing required fields",
                    extra={
                        "registry_id": registry_id,
                        "action_uuid": action.get("uuid"),
                        "missing_fields": translator.missing_fields,
                    },
                )
                continue

            try:
                notification_action = Action(
                    type=translator.action_type,
                    data=translator.get_sanitized_data(),
                    integration_id=translator.integration_id,
                    config=translator.action_config,
                )

                notification_actions.append(notification_action)
            except Exception as e:
                logger.exception(
                    "Failed to translate action",
                    extra={"action": action, "error": str(e)},
                )

        return notification_actions

    def _build_notification_actions_from_rule_data_actions(
        actions: list[dict[str, Any]]
    ) -> list[Any]:
        notification_actions = _translate_rule_data_actions_to_notification_actions(actions)

        for action in notification_actions:
            action.save()
        return notification_actions

    def _create_event_unique_user_frequency_condition_with_conditions(
        data: dict[str, Any], dcg: Any, conditions: list[dict[str, Any]] | None = None
    ) -> Any:
        comparison_type = data.get("comparisonType", "count")
        if comparison_type not in ("count", "percent"):
            raise ValueError(f"Invalid comparison type: {comparison_type}")
        value = max(int(data["value"]), 0)  # force to 0 if negative

        comparison = {
            "interval": data["interval"],
            "value": value,
        }

        if comparison_type == "count":
            type = "event_unique_user_frequency_count"
        else:
            type = "event_unique_user_frequency_percent"
            comparison["comparison_interval"] = data["comparisonInterval"]

        comparison_filters = []

        if conditions:
            for condition in conditions:
                condition_id = condition["id"]
                comparison_filter: dict[str, Any] = {}

                match condition_id:
                    case "sentry.rules.filters.event_attribute.EventAttributeFilter":
                        comparison_filter["attribute"] = condition["attribute"]
                    case "sentry.rules.filters.event_attribute.EventAttributeFilter":
                        comparison_filter["key"] = condition["key"]
                    case _:
                        raise ValueError(f"Unsupported condition: {condition_id}")

                match = MatchType(condition["match"])
                comparison_filter["match"] = match

                if match not in {MatchType.IS_SET, MatchType.NOT_SET}:
                    comparison_filter["value"] = condition["value"]

                comparison_filters.append(comparison_filter)

        comparison["filters"] = comparison_filters

        return DataCondition(
            type=type,
            comparison=comparison,
            condition_result=True,
            condition_group_id=dcg.id,
        )

    def _bulk_create_data_conditions(
        rule: Any,
        conditions: list[dict[str, Any]],
        dcg: Any,
        filters: list[dict[str, Any]] | None = None,
    ) -> list[Any]:
        dcg_conditions: list[Any] = []

        for condition in conditions:
            try:
                if (
                    condition["id"]
                    == "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions"
                ):  # special case: this condition uses filters, so the migration needs to combine the filters into the condition
                    dcg_conditions.append(
                        _create_event_unique_user_frequency_condition_with_conditions(
                            dict(condition), dcg, filters
                        )
                    )
                else:
                    dcg_conditions.append(translate_to_data_condition(dict(condition), dcg=dcg))
            except Exception as e:
                logger.exception(
                    "workflow_engine.issue_alert_migration.error",
                    extra={"rule_id": rule.id, "error": str(e)},
                )

        filtered_data_conditions = [
            dc for dc in dcg_conditions if dc.type not in SKIPPED_CONDITIONS
        ]

        data_conditions: list[Any] = []
        # try one by one, ignoring errors
        for dc in filtered_data_conditions:
            try:
                dc.save()
                data_conditions.append(dc)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                logger.exception(
                    "workflow_engine.issue_alert_migration.error",
                    extra={"rule_id": rule.id, "error": str(e)},
                )
        return data_conditions

    def _create_when_dcg(
        action_match: str,
        organization: Any,
    ) -> Any:
        if action_match == "any":
            logic_type = DataConditionGroupType.ANY_SHORT_CIRCUIT.value
        else:
            logic_type = DataConditionGroupType(action_match)

        when_dcg = DataConditionGroup.objects.create(
            organization=organization, logic_type=logic_type
        )

        return when_dcg

    def _create_workflow_and_lookup(
        rule: Any,
        user_id: int | None,
        conditions: list[dict[str, Any]],
        filters: list[dict[str, Any]],
        action_match: str,
        detector: Any,
    ) -> Any:
        when_dcg = _create_when_dcg(
            organization=rule.project.organization, action_match=action_match
        )
        data_conditions = _bulk_create_data_conditions(
            rule=rule, conditions=conditions, filters=filters, dcg=when_dcg
        )

        # the only time the data_conditions list will be empty is if somebody only has EveryEventCondition in their conditions list.
        # if it's empty and this is not the case, we should not migrate
        no_conditions = len(conditions) == 0
        no_data_conditions = len(data_conditions) == 0
        only_has_every_event_cond = (
            len(conditions) == 1
            and conditions[0]["id"] == "sentry.rules.conditions.every_event.EveryEventCondition"
        )

        if no_data_conditions and no_conditions:
            # originally no conditions and we expect no data conditions
            pass
        elif no_data_conditions and not only_has_every_event_cond:
            raise Exception("No valid trigger conditions, skipping migration")

        enabled = True
        rule_snooze = RuleSnooze.objects.filter(rule=rule, user_id=None).first()
        if rule_snooze and rule_snooze.until is None:
            enabled = False
        if rule.status == 1:  # ObjectStatus.DISABLED
            enabled = False

        config = {"frequency": rule.data.get("frequency") or 30}  # Workflow.DEFAULT_FREQUENCY
        kwargs = {
            "organization": organization,
            "name": rule.label,
            "environment_id": rule.environment_id,
            "when_condition_group": when_dcg,
            "created_by_id": user_id,
            "owner_user_id": rule.owner_user_id,
            "owner_team": rule.owner_team,
            "config": config,
            "enabled": enabled,
        }

        workflow = Workflow.objects.create(**kwargs)
        workflow.date_added = rule.date_added
        workflow.save()
        Workflow.objects.filter(id=workflow.id).update(date_added=rule.date_added)
        DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow_id=workflow.id)

        return workflow

    def _create_if_dcg(
        rule: Any,
        organization: Any,
        filter_match: str,
        workflow: Any,
        conditions: list[dict[str, Any]],
        filters: list[dict[str, Any]],
    ) -> Any:
        if (
            filter_match == "any" or filter_match is None
        ):  # must create IF DCG even if it's empty, to attach actions
            logic_type = DataConditionGroupType.ANY_SHORT_CIRCUIT
        else:
            logic_type = DataConditionGroupType(filter_match)

        if_dcg = DataConditionGroup.objects.create(organization=organization, logic_type=logic_type)
        WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=if_dcg)

        conditions_ids = [condition["id"] for condition in conditions]
        # skip migrating filters for special case
        if "EventUniqueUserFrequencyConditionWithConditions" not in conditions_ids:
            _bulk_create_data_conditions(rule=rule, conditions=filters, dcg=if_dcg)

        return if_dcg

    def _create_workflow_actions(if_dcg: Any, actions: list[dict[str, Any]]) -> None:
        notification_actions = _build_notification_actions_from_rule_data_actions(actions)
        dcg_actions = [
            DataConditionGroupAction(action_id=action.id, condition_group_id=if_dcg.id)
            for action in notification_actions
        ]
        DataConditionGroupAction.objects.bulk_create(dcg_actions)

    # EXECUTION STARTS HERE
    for project in RangeQuerySetWrapperWithProgressBarApprox(Project.objects.all()):
        organization = project.organization
        error_detector, _ = Detector.objects.get_or_create(
            type="error",
            project=project,
            defaults={"config": {}, "name": "Error Detector"},
        )

        with transaction.atomic(router.db_for_write(Rule)):
            rules = Rule.objects.select_for_update().filter(project=project)

            for rule in RangeQuerySetWrapperWithProgressBarApprox(rules):
                try:
                    with transaction.atomic(router.db_for_write(Workflow)):
                        # make sure rule is not already migrated
                        _, created = AlertRuleDetector.objects.get_or_create(
                            detector_id=error_detector.id, rule_id=rule.id
                        )
                        if not created:
                            raise SkipMigratingException("Rule already migrated")

                        data = rule.data
                        user_id = None
                        created_activity = RuleActivity.objects.filter(
                            rule=rule, type=1  # created
                        ).first()
                        if created_activity:
                            user_id = getattr(created_activity, "user_id")

                        conditions, filters = split_conditions_and_filters(data["conditions"])
                        action_match = data.get("action_match") or "all"
                        workflow = _create_workflow_and_lookup(
                            rule=rule,
                            user_id=int(user_id) if user_id else None,
                            conditions=conditions,
                            filters=filters,
                            action_match=action_match,
                            detector=error_detector,
                        )
                        filter_match = data.get("filter_match") or "all"
                        if_dcg = _create_if_dcg(
                            rule=rule,
                            organization=rule.project.organization,
                            filter_match=filter_match,
                            workflow=workflow,
                            conditions=conditions,
                            filters=filters,
                        )
                        _create_workflow_actions(if_dcg=if_dcg, actions=data["actions"])
                except Exception as e:
                    logger.exception(
                        "Error migrating issue alert", extra={"rule_id": rule.id, "error": str(e)}
                    )
                    sentry_sdk.capture_exception(e)


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("workflow_engine", "0042_workflow_fire_history_add_fired_actions_bool"),
    ]

    operations = [
        migrations.RunPython(
            migrate_issue_alerts,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_rule"]},
        ),
    ]

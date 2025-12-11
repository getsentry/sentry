from __future__ import annotations

import dataclasses
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, IntEnum, StrEnum
from typing import Any, ClassVar, NotRequired, TypedDict

from sentry.utils import json

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
    AZURE_DEVOPS = "vsts"

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

    FALLTHROUGH_TYPE_KEY = "fallthrough_type"
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
                    fallthrough_type=self.action.get(
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
                # stringify setting value if it's a list
                if isinstance(setting.get("value"), list):
                    setting["value"] = json.dumps(setting["value"])
                data.settings.append(SentryAppFormConfigDataBlob(**setting))

        return dataclasses.asdict(data)

    @property
    def blob_type(self) -> type[DataBlob]:
        return SentryAppDataBlob


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
    dynamic_form_fields: list[dict[str, Any]] = field(default_factory=list)
    # Store any additional fields that aren't part of standard fields
    additional_fields: dict[str, Any] = field(default_factory=dict)


@dataclass
class SentryAppFormConfigDataBlob(DataBlob):
    """
    SentryAppFormConfigDataBlob represents a single form config field for a Sentry App.
    name is the name of the form field, and value is the value of the form field.
    """

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SentryAppFormConfigDataBlob:
        if not isinstance(data.get("name"), str) or not isinstance(
            data.get("value"), (str, type(None), int)
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
    def from_list(cls, data: list[dict[str, Any]] | None) -> SentryAppDataBlob:
        if data is None:
            return cls()
        return cls(settings=[SentryAppFormConfigDataBlob.from_dict(setting) for setting in data])


@dataclass
class EmailDataBlob(DataBlob):
    """
    EmailDataBlob represents the data blob for an email notification action.
    """

    fallthrough_type: str = ""


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

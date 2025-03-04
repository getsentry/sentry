from __future__ import annotations

import dataclasses
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, ClassVar, NotRequired, TypedDict

from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.pagerduty.client import PAGERDUTY_DEFAULT_SEVERITY
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.sentry_apps.services.app import app_service
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.action import Action

# Keep existing excluded keys constant
EXCLUDED_ACTION_DATA_KEYS = ["uuid", "id"]


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


ACTION_FIELD_MAPPINGS: dict[Action.Type, ActionFieldMapping] = {
    Action.Type.SLACK: ActionFieldMapping(
        id="sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
        integration_id_key="workspace",
        target_identifier_key="channel_id",
        target_display_key="channel",
    ),
    Action.Type.DISCORD: ActionFieldMapping(
        id="sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
        integration_id_key="server",
        target_identifier_key="channel_id",
    ),
    Action.Type.MSTEAMS: ActionFieldMapping(
        id="sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
        integration_id_key="team",
        target_identifier_key="channel_id",
        target_display_key="channel",
    ),
    Action.Type.PAGERDUTY: ActionFieldMapping(
        id="sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
        integration_id_key="account",
        target_identifier_key="service",
    ),
    Action.Type.OPSGENIE: ActionFieldMapping(
        id="sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
        integration_id_key="account",
        target_identifier_key="team",
    ),
    Action.Type.GITHUB: ActionFieldMapping(
        id="sentry.integrations.github.notify_action.GitHubCreateTicketAction",
        integration_id_key="integration",
    ),
    Action.Type.GITHUB_ENTERPRISE: ActionFieldMapping(
        id="sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
        integration_id_key="integration",
    ),
    Action.Type.AZURE_DEVOPS: ActionFieldMapping(
        id="sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
        integration_id_key="integration",
    ),
    Action.Type.JIRA: ActionFieldMapping(
        id="sentry.integrations.jira.notify_action.JiraCreateTicketAction",
        integration_id_key="integration",
    ),
    Action.Type.JIRA_SERVER: ActionFieldMapping(
        id="sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
        integration_id_key="integration",
    ),
    Action.Type.EMAIL: ActionFieldMapping(
        id="sentry.mail.actions.NotifyEmailAction",
        target_identifier_key="targetIdentifier",
    ),
    Action.Type.PLUGIN: ActionFieldMapping(
        id="sentry.rules.actions.notify_event.NotifyEventAction",
    ),
    Action.Type.WEBHOOK: ActionFieldMapping(
        id="sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        target_identifier_key="service",
    ),
    Action.Type.SENTRY_APP: ActionFieldMapping(
        id="sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
        target_identifier_key="sentryAppInstallationUuid",
    ),
}


class BaseActionTranslator(ABC):
    @property
    @abstractmethod
    def action_type(self) -> Action.Type:
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
    def target_type(self) -> ActionTarget | None:
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


issue_alert_action_translator_registry = Registry[type[BaseActionTranslator]](
    enable_reverse_lookup=False
)


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.SLACK]["id"])
class SlackActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.SLACK

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[Action.Type.SLACK][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[Action.Type.SLACK][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[Action.Type.SLACK][
                ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value
            ],
        ]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def blob_type(self) -> type[DataBlob]:
        return SlackDataBlob


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.DISCORD]["id"])
class DiscordActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.DISCORD

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[Action.Type.DISCORD][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[Action.Type.DISCORD][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
        ]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def blob_type(self) -> type[DataBlob]:
        return DiscordDataBlob


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.MSTEAMS]["id"])
class MSTeamsActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.MSTEAMS

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[Action.Type.MSTEAMS][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[Action.Type.MSTEAMS][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[Action.Type.MSTEAMS][
                ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value
            ],
        ]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def blob_type(self) -> type[DataBlob]:
        return OnCallDataBlob


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.PAGERDUTY]["id"])
class PagerDutyActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.PAGERDUTY

    field_mappings = {
        "priority": FieldMapping(
            source_field="severity", default_value=str(PAGERDUTY_DEFAULT_SEVERITY)
        )
    }

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[Action.Type.PAGERDUTY][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[Action.Type.PAGERDUTY][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
        ]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def blob_type(self) -> type[DataBlob]:
        return OnCallDataBlob


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.OPSGENIE]["id"])
class OpsgenieActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.OPSGENIE

    field_mappings = {
        "priority": FieldMapping(
            source_field="priority", default_value=str(OPSGENIE_DEFAULT_PRIORITY)
        )
    }

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[Action.Type.OPSGENIE][
                ActionFieldMappingKeys.INTEGRATION_ID_KEY.value
            ],
            ACTION_FIELD_MAPPINGS[Action.Type.OPSGENIE][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ],
        ]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

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
        dynamic_form_fields = data.get(TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value, {})

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
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def blob_type(self) -> type[DataBlob]:
        return TicketDataBlob

    def get_sanitized_data(self) -> dict[str, Any]:
        """
        Override to handle custom fields and additional fields that aren't part of the standard fields.
        """
        data = super().get_sanitized_data()
        if self.blob_type:
            # Use helper to separate fields, excluding required fields
            _, additional_fields = self.separate_fields(
                self.action, excluded_keys=self.required_fields
            )
            data[TicketFieldMappingKeys.ADDITIONAL_FIELDS_KEY.value] = additional_fields
        return data


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.GITHUB]["id"])
class GithubActionTranslator(TicketActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.GITHUB


@issue_alert_action_translator_registry.register(
    ACTION_FIELD_MAPPINGS[Action.Type.GITHUB_ENTERPRISE]["id"]
)
class GithubEnterpriseActionTranslator(TicketActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.GITHUB_ENTERPRISE


@issue_alert_action_translator_registry.register(
    ACTION_FIELD_MAPPINGS[Action.Type.AZURE_DEVOPS]["id"]
)
class AzureDevopsActionTranslator(TicketActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.AZURE_DEVOPS


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.JIRA]["id"])
class JiraActionTranslatorBase(TicketActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.JIRA


@issue_alert_action_translator_registry.register(
    ACTION_FIELD_MAPPINGS[Action.Type.JIRA_SERVER]["id"]
)
class JiraServerActionTranslatorBase(TicketActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.JIRA_SERVER


class EmailActionHelper(ABC):
    target_type_mapping = {
        ActionTarget.USER: ActionTargetType.MEMBER.value,
        ActionTarget.TEAM: ActionTargetType.TEAM.value,
        ActionTarget.ISSUE_OWNERS: ActionTargetType.ISSUE_OWNERS.value,
    }

    reverse_target_type_mapping = {v: k for k, v in target_type_mapping.items()}

    @staticmethod
    def get_target_type_object(target_type: str) -> ActionTarget:
        return EmailActionHelper.reverse_target_type_mapping[target_type]

    @staticmethod
    def get_target_type_string(target_type: ActionTarget) -> str:
        return EmailActionHelper.target_type_mapping[target_type]


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.EMAIL]["id"])
class EmailActionTranslator(BaseActionTranslator, EmailActionHelper):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.EMAIL

    @property
    def required_fields(self) -> list[str]:
        return [
            EmailFieldMappingKeys.TARGET_TYPE_KEY.value,
        ]

    @property
    def target_type(self) -> ActionTarget:
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
            return self.action.get(
                ACTION_FIELD_MAPPINGS[Action.Type.EMAIL][
                    ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
                ]
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


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.PLUGIN]["id"])
class PluginActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.PLUGIN

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


@issue_alert_action_translator_registry.register(ACTION_FIELD_MAPPINGS[Action.Type.WEBHOOK]["id"])
class WebhookActionTranslator(BaseActionTranslator):
    def __init__(self, action: dict[str, Any]):
        super().__init__(action)
        # Fetch the sentry app id using app_service
        # If the app exists, we should heal this action as a SentryAppAction
        # Based on sentry/rules/actions/notify_event_service.py
        if service := self.action.get(
            ACTION_FIELD_MAPPINGS[Action.Type.WEBHOOK][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ]
        ):
            self.sentry_app = app_service.get_sentry_app_by_slug(slug=service)
        else:
            self.sentry_app = None

    @property
    def action_type(self) -> Action.Type:
        if self.sentry_app:
            return Action.Type.SENTRY_APP
        else:
            return Action.Type.WEBHOOK

    @property
    def target_type(self) -> ActionTarget | None:
        if self.sentry_app:
            return ActionTarget.SENTRY_APP
        return None

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[Action.Type.WEBHOOK][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ]
        ]

    @property
    def target_identifier(self) -> str | None:
        # The service field identifies the webhook
        # If the webhook goes to a sentry app, then we should identify the sentry app by id
        if self.sentry_app:
            return str(self.sentry_app.id)
        return self.action.get(
            ACTION_FIELD_MAPPINGS[Action.Type.WEBHOOK][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ]
        )


@issue_alert_action_translator_registry.register(
    ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["id"]
)
class SentryAppActionTranslator(BaseActionTranslator):
    @property
    def action_type(self) -> Action.Type:
        return Action.Type.SENTRY_APP

    @property
    def required_fields(self) -> list[str]:
        return [
            ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP][
                ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value
            ]
        ]

    @property
    def target_type(self) -> ActionTarget | None:
        return ActionTarget.SENTRY_APP

    @property
    def target_identifier(self) -> str | None:
        # Fetch the sentry app id using app_service
        # Based on sentry/rules/actions/sentry_apps/notify_event.py
        sentry_app_installation = app_service.get_many(
            filter=dict(
                uuids=[
                    self.action.get(
                        ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["target_identifier_key"]
                    )
                ]
            )
        )

        if sentry_app_installation:
            assert len(sentry_app_installation) == 1, "Expected exactly one sentry app installation"
            return str(sentry_app_installation[0].sentry_app.id)

        raise ValueError("Sentry app installation not found")

    def get_sanitized_data(self) -> dict[str, Any]:
        data = SentryAppDataBlob()
        if settings := self.action.get("settings"):
            for setting in settings:
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
    def from_dict(cls, data: dict[str, Any]) -> SentryAppFormConfigDataBlob:
        if not isinstance(data.get("name"), str) or not isinstance(data.get("value"), str):
            raise ValueError("Sentry app config must contain name and value keys")
        return cls(name=data["name"], value=data["value"], label=data.get("label"))

    name: str = ""
    value: str = ""
    label: str | None = None


@dataclass
class SentryAppDataBlob(DataBlob):
    """
    Represents a Sentry App notification action.
    """

    settings: list[SentryAppFormConfigDataBlob] = field(
        default_factory=list[SentryAppFormConfigDataBlob]
    )

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

    fallthroughType: str = ""

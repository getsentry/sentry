import dataclasses
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar

from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.pagerduty.client import PAGERDUTY_DEFAULT_SEVERITY
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.action import Action

# Keep existing excluded keys constant
EXCLUDED_ACTION_DATA_KEYS = ["uuid", "id"]


@dataclass
class FieldMapping:
    """FieldMapping is a class that represents the mapping of a target field to a source field."""

    source_field: str
    default_value: Any = None


class BaseActionTranslator(ABC):
    action_type: ClassVar[Action.Type]
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
    def target_type(self) -> ActionTarget:
        """Return the target type for this action"""
        pass

    @property
    @abstractmethod
    def integration_id(self) -> Any | None:
        """Return the integration ID for this action, if any"""
        pass

    @property
    def target_identifier(self) -> str | None:
        """Return the target identifier for this action, if any"""
        return None

    @property
    def target_display(self) -> str | None:
        """Return the display name for the target, if any"""
        return None

    @property
    def blob_type(self) -> type["DataBlob"] | None:
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
            for field_info in dataclasses.fields(self.blob_type):
                mapping = self.field_mappings.get(field_info.name)
                # If a mapping is specified, use the source field value or default value
                if mapping:
                    source_field = mapping.source_field
                    value = self.action.get(source_field, mapping.default_value)
                # Otherwise, use the field value
                else:
                    value = self.action.get(field_info.name, "")
                mapped_data[field_info.name] = value

            blob_instance = self.blob_type(**mapped_data)
            return dataclasses.asdict(blob_instance)
        else:
            # Remove excluded keys and required fields
            excluded_keys = EXCLUDED_ACTION_DATA_KEYS + self.required_fields
            return {k: v for k, v in self.action.items() if k not in excluded_keys}


issue_alert_action_translator_registry = Registry[type[BaseActionTranslator]](
    enable_reverse_lookup=False
)


@issue_alert_action_translator_registry.register(
    "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"
)
class SlackActionTranslator(BaseActionTranslator):
    action_type = Action.Type.SLACK

    @property
    def required_fields(self) -> list[str]:
        return ["channel_id", "workspace", "channel"]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def integration_id(self) -> Any | None:
        return self.action.get("workspace")

    @property
    def target_identifier(self) -> str | None:
        return self.action.get("channel_id")

    @property
    def target_display(self) -> str | None:
        return self.action.get("channel")

    @property
    def blob_type(self) -> type["DataBlob"]:
        return SlackDataBlob


@issue_alert_action_translator_registry.register(
    "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction"
)
class DiscordActionTranslator(BaseActionTranslator):
    action_type = Action.Type.DISCORD

    @property
    def required_fields(self) -> list[str]:
        return ["server", "channel_id"]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def integration_id(self) -> Any | None:
        return self.action.get("server")

    @property
    def target_identifier(self) -> str | None:
        return self.action.get("channel_id")

    @property
    def blob_type(self) -> type["DataBlob"]:
        return DiscordDataBlob


@issue_alert_action_translator_registry.register(
    "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction"
)
class MSTeamsActionTranslator(BaseActionTranslator):
    action_type = Action.Type.MSTEAMS

    @property
    def required_fields(self) -> list[str]:
        return ["team", "channel_id", "channel"]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def integration_id(self) -> Any | None:
        return self.action.get("team")

    @property
    def target_identifier(self) -> str | None:
        return self.action.get("channel_id")

    @property
    def target_display(self) -> str | None:
        return self.action.get("channel")


@issue_alert_action_translator_registry.register(
    "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction"
)
class PagerDutyActionTranslator(BaseActionTranslator):
    action_type = Action.Type.PAGERDUTY
    field_mappings = {
        "priority": FieldMapping(
            source_field="severity", default_value=str(PAGERDUTY_DEFAULT_SEVERITY)
        )
    }

    @property
    def required_fields(self) -> list[str]:
        return ["account", "service"]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def integration_id(self) -> Any | None:
        return self.action.get("account")

    @property
    def target_identifier(self) -> str | None:
        return self.action.get("service")

    @property
    def blob_type(self) -> type["DataBlob"]:
        return OnCallDataBlob


@issue_alert_action_translator_registry.register(
    "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction"
)
class OpsgenieActionTranslator(BaseActionTranslator):
    action_type = Action.Type.OPSGENIE
    field_mappings = {
        "priority": FieldMapping(
            source_field="priority", default_value=str(OPSGENIE_DEFAULT_PRIORITY)
        )
    }

    @property
    def required_fields(self) -> list[str]:
        return ["account", "team"]

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def integration_id(self) -> Any | None:
        return self.action.get("account")

    @property
    def target_identifier(self) -> str | None:
        return self.action.get("team")

    @property
    def blob_type(self) -> type["DataBlob"]:
        return OnCallDataBlob


class TicketActionTranslator(BaseActionTranslator, ABC):
    @property
    def required_fields(self) -> list[str]:
        return ["integration"]

    @property
    def integration_id(self) -> Any | None:
        return self.action.get("integration")

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC


@issue_alert_action_translator_registry.register(
    "sentry.integrations.github.notify_action.GitHubCreateTicketAction"
)
@issue_alert_action_translator_registry.register(
    "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction"
)
class GitHubActionTranslator(TicketActionTranslator):
    action_type = Action.Type.GITHUB

    @property
    def blob_type(self) -> type["DataBlob"]:
        return GitHubDataBlob


@issue_alert_action_translator_registry.register(
    "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction"
)
class AzureDevOpsActionTranslator(TicketActionTranslator):
    action_type = Action.Type.AZURE_DEVOPS

    @property
    def blob_type(self) -> type["DataBlob"]:
        return AzureDevOpsDataBlob


@dataclass
class DataBlob:
    """DataBlob is a generic type that represents the data blob for a notification action."""

    pass


@dataclass
class SlackDataBlob(DataBlob):
    """SlackDataBlob is a specific type that represents the data blob for a Slack notification action."""

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
    """OnCallDataBlob is a specific type that represents the data blob for a PagerDuty or Opsgenie notification action."""

    priority: str = ""


@dataclass
class TicketDataBlob(DataBlob):
    """TicketDataBlob is a specific type that represents the data blob for a ticket creation action."""

    # This is dynamic and can whatever customer config the customer setup on GitHub
    dynamic_form_fields: list[dict] = field(default_factory=list)


@dataclass
class GitHubDataBlob(TicketDataBlob):
    """
    GitHubDataBlob represents the data blob for a GitHub ticket creation action.
    """

    repo: str = ""
    assignee: str = ""  # Optional field, defaults to empty string
    labels: list[str] = field(default_factory=list)  # Optional field, defaults to empty list


@dataclass
class AzureDevOpsDataBlob(TicketDataBlob):
    """
    AzureDevOpsDataBlob represents the data blob for an Azure DevOps ticket creation action.
    """

    project: str = ""
    work_item_type: str = ""

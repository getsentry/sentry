import dataclasses
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, ClassVar

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.utils.registry import Registry
from sentry.workflow_engine.models.action import Action

# Keep existing excluded keys constant
EXCLUDED_ACTION_DATA_KEYS = ["uuid", "id"]


class BaseActionTranslator(ABC):
    action_type: ClassVar[Action.Type]

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
            # Convert to dataclass if blob type is specified
            blob_instance = self.blob_type(
                **{k.name: self.action.get(k.name, "") for k in dataclasses.fields(self.blob_type)}
            )
            return dataclasses.asdict(blob_instance)
        else:
            # Remove excluded keys and required fields
            excluded_keys = EXCLUDED_ACTION_DATA_KEYS + self.required_fields
            return {k: v for k, v in self.action.items() if k not in excluded_keys}


issue_alert_action_translator_registry = Registry[type[BaseActionTranslator]]()


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

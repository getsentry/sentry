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
    registry_id: ClassVar[str]

    def __init__(self, action: dict[str, Any]):
        self.action = action
        self._missing_fields: list[str] = []
        self._required_fields: list[str] = []

    @property
    def missing_fields(self) -> list[str]:
        return self._missing_fields

    @property
    def required_fields(self) -> list[str]:
        return self._required_fields

    @property
    @abstractmethod
    def target_type(self) -> ActionTarget:
        pass

    @property
    @abstractmethod
    def integration_id(self) -> Any | None:
        """Return the integration ID for this action, if any"""
        pass

    @property
    @abstractmethod
    def target_identifier(self) -> str | None:
        """Return the target identifier for this action, if any"""
        pass

    @property
    @abstractmethod
    def target_display(self) -> str | None:
        """Return the display name for the target, if any"""
        pass

    @property
    @abstractmethod
    def blob_type(self) -> type["DataBlob"] | None:
        pass

    def is_valid(self) -> bool:
        """
        Validate that all required fields for this action are present.
        Should be overridden by subclasses to add specific validation.
        """
        self._missing_fields = [
            field for field in self.required_fields if self.action.get(field) is None
        ]
        return len(self._missing_fields) == 0

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
            # Remove excluded keys
            return {k: v for k, v in self.action.items() if k not in EXCLUDED_ACTION_DATA_KEYS}


issue_alert_action_translator_registry = Registry[type[BaseActionTranslator]]()


@issue_alert_action_translator_registry.register(
    "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"
)
class SlackActionTranslator(BaseActionTranslator):
    action_type = Action.Type.SLACK
    registry_id = "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"

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


# Keep existing DataBlob classes
@dataclass
class DataBlob:
    """DataBlob is a generic type that represents the data blob for a notification action."""

    pass


@dataclass
class SlackDataBlob(DataBlob):
    """SlackDataBlob is a specific type that represents the data blob for a Slack notification action."""

    tags: str = ""
    notes: str = ""

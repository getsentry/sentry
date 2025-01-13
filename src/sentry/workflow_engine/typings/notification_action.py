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

    @property
    @abstractmethod
    def target_type(self) -> ActionTarget:
        pass

    @property
    @abstractmethod
    def integration_id_key(self) -> str | None:
        pass

    @property
    @abstractmethod
    def target_identifier_key(self) -> str | None:
        pass

    @property
    @abstractmethod
    def target_display_key(self) -> str | None:
        pass

    @property
    @abstractmethod
    def blob_type(self) -> type["DataBlob"] | None:
        pass

    def sanitize_action(self, data: dict[str, Any]) -> dict[str, Any]:
        return data


issue_alert_action_translator_registry = Registry[type[BaseActionTranslator]]()


@issue_alert_action_translator_registry.register(
    "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"
)
class SlackActionTranslator(BaseActionTranslator):
    action_type = Action.Type.SLACK
    registry_id = "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"

    @property
    def target_type(self) -> ActionTarget:
        return ActionTarget.SPECIFIC

    @property
    def integration_id_key(self) -> str:
        return "workspace"

    @property
    def target_identifier_key(self) -> str:
        return "channel_id"

    @property
    def target_display_key(self) -> str:
        return "channel"

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

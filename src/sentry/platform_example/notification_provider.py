import abc
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Generic, TypeVar

from sentry.platform_example.notification_renderer import NotificationRenderer
from sentry.platform_example.notification_target import NotificationTarget
from sentry.platform_example.notification_types import NotificationType, ProviderResourceType

RendererReturnTypeT = TypeVar("RendererReturnTypeT")


class NotificationProviderNames(StrEnum):
    EMAIL = "email"
    SLACK = "slack"
    DISCORD = "discord"


@dataclass
class ProviderTarget:
    provider_name: str
    resource_id: str
    resource_type: ProviderResourceType


class NotificationProvider(abc.ABC, Generic[RendererReturnTypeT]):
    @abc.abstractmethod
    def send_notification(
        self,
        notification_content: RendererReturnTypeT,
        notification_type: NotificationType,
        target: NotificationTarget,
    ) -> None:
        raise NotImplementedError("Subclasses must implement this method")

    @abc.abstractmethod
    def get_renderer(
        self, notification_type: NotificationType
    ) -> NotificationRenderer[RendererReturnTypeT]:
        raise NotImplementedError("Subclasses must implement this method")

    @abc.abstractmethod
    def get_additional_data_schema(self) -> dict[str, Any] | None:
        raise NotImplementedError("Subclasses must implement this method")

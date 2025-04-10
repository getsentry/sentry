import abc
from dataclasses import dataclass
from enum import StrEnum
from typing import Generic, TypeVar

from sentry.platform_example.notification_renderer import NotificationRenderer
from sentry.platform_example.notification_target import NotificationType

T = TypeVar("T")


class ProviderResourceType(StrEnum):
    IdentityLink = "identity_link"
    Channel = "channel"


@dataclass
class ProviderTarget:
    provider_name: str
    resource_id: str
    resource_type: ProviderResourceType


class NotificationProvider(abc.ABC, Generic[T]):
    @abc.abstractmethod
    def send_notification(
        self,
        notification_content: T,
        notification_type: NotificationType,
        target: ProviderTarget,
    ) -> None:
        raise NotImplementedError("Subclasses must implement this method")

    @abc.abstractmethod
    def get_renderer(self, notification_type: NotificationType) -> NotificationRenderer[T]:
        raise NotImplementedError("Subclasses must implement this method")

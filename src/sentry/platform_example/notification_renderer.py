import abc
from typing import Generic, TypeVar

from sentry.platform_example.notification import NotificationData, NotificationTemplate

T = TypeVar("T")


class NotificationRenderer(abc.ABC, Generic[T]):
    @abc.abstractmethod
    def render(
        self,
        notification_content: NotificationData,
        notification_template: NotificationTemplate,
    ) -> T:
        raise NotImplementedError("Subclasses must implement this method")

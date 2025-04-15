import abc
from typing import Generic, TypeVar

from sentry.platform_example.template.template_base import NotificationTemplate, TemplateData

T = TypeVar("T")


class NotificationRenderer(abc.ABC, Generic[T]):
    @abc.abstractmethod
    def render(
        self,
        notification_content: TemplateData,
        notification_template: NotificationTemplate,
    ) -> T:
        raise NotImplementedError("Subclasses must implement this method")

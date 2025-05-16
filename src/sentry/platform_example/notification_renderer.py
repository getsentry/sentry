import abc
from typing import Generic, TypeVar

from sentry.platform_example.template_base import NotificationTemplate, TemplateData

T = TypeVar("T")


class NotificationRenderer(abc.ABC, Generic[T]):
    @abc.abstractmethod
    def render(
        self,
        notification_content: TemplateData,
        notification_template: NotificationTemplate,
    ) -> T:
        # class with body, subject, chart, help_text
        raise NotImplementedError("Subclasses must implement this method")

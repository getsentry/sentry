from dataclasses import dataclass
from typing import Any

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationStrategy,
    NotificationTarget,
    NotificationTargetResourceType,
    NotificationTemplate,
)


class MockRenderer(NotificationRenderer[Any]):
    provider_key = NotificationProviderKey.MOCK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> Any:
        return {
            "subject": rendered_template.subject,
            "body": rendered_template.body,
            "actions": rendered_template.actions,
            "chart": rendered_template.chart,
            "footer": rendered_template.footer,
        }


@provider_registry.register(NotificationProviderKey.MOCK)
class MockIntegrationProvider(NotificationProvider[Any]):
    key = NotificationProviderKey.MOCK
    target_class = IntegrationNotificationTarget
    target_resource_types = [
        NotificationTargetResourceType.CHANNEL,
        NotificationTargetResourceType.DIRECT_MESSAGE,
    ]
    default_renderer = MockRenderer

    @classmethod
    def validate_rendered_template(cls, *, rendered_template: NotificationRenderedTemplate) -> None:
        assert isinstance(rendered_template.body, str)


@dataclass(kw_only=True, frozen=True)
class MockNotification(NotificationData):
    source = "test"
    message: str


@template_registry.register(MockNotification.source)
class MockNotificationTemplate(NotificationTemplate[MockNotification]):
    category = NotificationCategory.DEBUG

    def render(self, data: MockNotification) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Mock Notification",
            body=data.message,
            actions=[{"label": "Visit Sentry", "link": "https://www.sentry.io"}],
            footer="This is a mock footer",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Mock Notification",
            body="This is a mock notification",
            actions=[{"label": "Visit Sentry", "link": "https://www.sentry.io"}],
            footer="This is a mock footer",
        )


class MockStrategy(NotificationStrategy):
    def __init__(self, *, targets: list[NotificationTarget]):
        self.targets = targets

    def get_targets(self) -> list[NotificationTarget]:
        return self.targets

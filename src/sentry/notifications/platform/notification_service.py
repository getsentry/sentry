from typing import Any

from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.target import NotificationTarget


class NotificationService:
    @staticmethod
    def notify_target(
        target: NotificationTarget,
        template: Any,
        data: Any,
        thread_id: str | None = None,
    ) -> None:
        provider = provider_registry.get(target.provider_key)
        provider.dispatch_notification(
            target=target, template=template, data=data, thread_id=thread_id
        )

    @staticmethod
    def notify_many_targets(
        targets: list[NotificationTarget],
        template: Any,
        data: Any,
        thread_id: str | None = None,
    ) -> None: ...

import logging
from collections import defaultdict
from collections.abc import Mapping
from typing import Final

from sentry.notifications.platform.metrics import (
    NotificationEventLifecycleMetric,
    NotificationInteractionType,
)
from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationStrategy,
    NotificationTarget,
    NotificationTemplate,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_tasks

logger = logging.getLogger(__name__)


class NotificationServiceError(Exception):
    pass


class NotificationService[T: NotificationData]:
    def __init__(self, *, data: T):
        self.data: Final[T] = data

    def _get_and_validate_provider(
        self, target: NotificationTarget
    ) -> type[NotificationProvider[T]]:
        provider = provider_registry.get(target.provider_key)
        provider.validate_target(target=target)
        return provider

    def _render_template[RenderableT](
        self, template: NotificationTemplate[T], provider: type[NotificationProvider[RenderableT]]
    ) -> RenderableT:
        rendered_template = template.render(data=self.data)
        renderer = provider.get_renderer(data=self.data, category=template.category)
        return renderer.render(data=self.data, rendered_template=rendered_template)

    def notify_target(
        self, *, target: NotificationTarget
    ) -> None | dict[NotificationProviderKey, list[str]]:
        """
        Send a notification directly to a target synchronously.
        NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
              using this method directly to prevent unwanted noise associated with your notifications.
        NOTE: Use this method when you care about the notification sending result and delivering that back to the user.
              Otherwise, we generally reccomend using the async version.
        """
        if not self.data:
            raise NotificationServiceError(
                "Notification service must be initialized with data before sending!"
            )

        with NotificationEventLifecycleMetric(
            interaction_type=NotificationInteractionType.NOTIFY_TARGET_SYNC,
            notification_source=self.data.source,
            notification_provider=target.provider_key,
        ).capture() as lifecycle:
            # Step 1: Get the provider, and validate the target against it
            provider = self._get_and_validate_provider(target=target)

            # Step 2: Render the template
            template_cls = template_registry.get(self.data.source)
            template = template_cls()
            renderable = self._render_template(template=template, provider=provider)

            # Step 3: Send the notification
            try:
                provider.send(target=target, renderable=renderable)
            except ApiError as e:
                lifecycle.record_failure(failure_reason=e, create_issue=False)
                raise
            return None

    @instrumented_task(
        name="src.sentry.notifications.platform.service.notify_target_async",
        namespace=notifications_tasks,
        processing_deadline_duration=30,
        silo_mode=SiloMode.REGION,
    )
    def notify_target_async(self, *, target: NotificationTarget) -> None:
        """
        Send a notification directly to a target asynchronously.
        NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
              using this method directly to prevent unwanted noise associated with your notifications.
        """
        if not self.data:
            raise NotificationServiceError(
                "Notification service must be initialized with data before sending!"
            )

        with NotificationEventLifecycleMetric(
            interaction_type=NotificationInteractionType.NOTIFY_TARGET_ASYNC,
            notification_source=self.data.source,
            notification_provider=target.provider_key,
        ).capture() as lifecycle:
            # Step 1: Get the provider, and validate the target against it
            provider = self._get_and_validate_provider(target=target)

            # Step 2: Render the template
            template_cls = template_registry.get(self.data.source)
            template = template_cls()
            renderable = self._render_template(template=template, provider=provider)

            # Step 3: Send the notification
            try:
                provider.send(target=target, renderable=renderable)
            except ApiError as e:
                lifecycle.record_failure(failure_reason=e, create_issue=False)

    def notify(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
        sync_send: bool = False,
    ) -> None | Mapping[NotificationProviderKey, list[ApiError]]:
        if not strategy and not targets:
            raise NotificationServiceError(
                "Must provide either a strategy or targets. Strategy is preferred."
            )
        if strategy and targets:
            raise NotificationServiceError(
                "Cannot provide both strategy and targets, only one is permitted. Strategy is preferred."
            )
        if strategy:
            targets = strategy.get_targets()
        if not targets:
            logger.info("Strategy '%s' did not yield targets", strategy.__class__.__name__)
            return None

        if sync_send:
            errors = defaultdict(list)
            for target in targets:
                try:
                    self.notify_target(target=target)
                except ApiError as e:
                    errors[target.provider_key].append(e)
            return errors

        else:
            for target in targets:
                self.notify_target_async.delay(self, target=target)
        return None

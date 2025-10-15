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

logger = logging.getLogger(__name__)


class NotificationServiceError(Exception):
    pass


class NotificationService[T: NotificationData]:
    def __init__(self, *, data: T):
        self.data: Final[T] = data

    def notify_target(self, *, target: NotificationTarget) -> None:
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

        event_lifecycle = NotificationEventLifecycleMetric(
            interaction_type=NotificationInteractionType.NOTIFY_TARGET_SYNC,
            notification_source=self.data.source,
            notification_provider=target.provider_key,
        )

        with event_lifecycle.capture() as lifecycle:
            # Step 1: Get the provider, and validate the target against it
            provider = provider_registry.get(target.provider_key)
            provider.validate_target(target=target)

            # Step 2: Render the template
            template_cls = template_registry.get(self.data.source)
            template = template_cls()

            # Update the lifecycle with the notification category now that we know it
            event_lifecycle.notification_category = template.category
            renderable = NotificationService.render_template(
                data=self.data, template=template, provider=provider
            )

            # Step 3: Send the notification
            try:
                provider.send(target=target, renderable=renderable)
            except Exception as e:
                lifecycle.record_failure(failure_reason=e, create_issue=False)
                raise
            return None

    @classmethod
    def render_template[RenderableT](
        cls,
        data: T,
        template: NotificationTemplate[T],
        provider: type[NotificationProvider[RenderableT]],
    ) -> RenderableT:
        rendered_template = template.render(data=data)
        renderer = provider.get_renderer(data=data, category=template.category)
        return renderer.render(data=data, rendered_template=rendered_template)

    def notify_async(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> None:
        """
        Send a notification directly to a target via task, if you care about using the result of the notification, use notify_sync instead.
        """
        self._validate_strategy_and_targets(strategy=strategy, targets=targets)
        targets = self._get_targets(strategy=strategy, targets=targets)

        for target in targets:
            notify_target_async(target=target)

    def notify_sync(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> Mapping[NotificationProviderKey, list[str]]:
        self._validate_strategy_and_targets(strategy=strategy, targets=targets)
        targets = self._get_targets(strategy=strategy, targets=targets)

        errors = defaultdict(list)
        for target in targets:
            try:
                self.notify_target(target=target)
            except ApiError as e:
                errors[target.provider_key].append(e.text)
        return errors

    def _validate_strategy_and_targets(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> None:
        if not strategy and not targets:
            raise NotificationServiceError(
                "Must provide either a strategy or targets. Strategy is preferred."
            )
        if strategy and targets:
            raise NotificationServiceError(
                "Cannot provide both strategy and targets, only one is permitted. Strategy is preferred."
            )

    def _get_targets(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
    ) -> list[NotificationTarget]:
        if strategy:
            targets = strategy.get_targets()
        if not targets:
            logger.warning("Strategy '%s' did not yield targets", strategy.__class__.__name__)
            return []
        return targets


def notify_target_async(*, target: NotificationTarget) -> None:
    """
    Send a notification directly to a target asynchronously.
    NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
            using this method directly to prevent unwanted noise associated with your notifications.
    """
    raise NotImplementedError

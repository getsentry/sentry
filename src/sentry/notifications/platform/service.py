import logging
from typing import Final

from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.target import prepare_targets
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationStrategy,
    NotificationTarget,
    NotificationTemplate,
)

logger = logging.getLogger(__name__)


class NotificationServiceError(Exception):
    pass


class NotificationService[T: NotificationData]:
    def __init__(self, *, data: T):
        self.data: Final[T] = data

    # TODO(ecosystem): Eventually this should be converted to spawn a task with the business logic below
    def notify_prepared_target(
        self,
        *,
        target: NotificationTarget,
        template: NotificationTemplate[T],
    ) -> None:
        """
        Send a notification directly to a prepared target.
        NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
        using this method directly to prevent unwanted noise associated with your notifications.
        """
        if not self.data:
            raise NotificationServiceError(
                "Notification service must be initialized with data before sending!"
            )

        # Step 1: Ensure the target has already been prepared.
        if not target.is_prepared:
            raise NotificationServiceError(
                "Target must have `prepare_targets` called prior to sending"
            )

        # Step 3: Get the provider, and validate the target against it
        provider = provider_registry.get(target.provider_key)
        provider.validate_target(target=target)

        # Step 4: Render the template
        rendered_template = template.render(data=self.data)
        renderer = provider.get_renderer(category=template.category)
        renderable = renderer.render(data=self.data, rendered_template=rendered_template)

        # Step 5: Send the notification
        provider.send(target=target, renderable=renderable)

    def notify(
        self,
        *,
        strategy: NotificationStrategy | None = None,
        targets: list[NotificationTarget] | None = None,
        template: NotificationTemplate[T],
    ) -> None:
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
            return

        # Prepare the targets for sending by fetching integration data, etc.
        prepare_targets(targets=targets)

        for target in targets:
            self.notify_prepared_target(target=target, template=template)

import logging

from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.target import NotificationTarget, prepare_targets
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationStrategy,
    NotificationTemplate,
)

logger = logging.getLogger(__name__)


class NotificationServiceError(Exception):
    pass


def _notify_target[
    T: NotificationData
](*, target: NotificationTarget, data: T, template: NotificationTemplate[T],) -> None:
    """
    Send a notification directly to a target.
    NOTE: This method ignores notification settings. When possible, consider using a strategy instead of
    using this method directly to prevent unwanted noise associated with your notifications.
    """
    # Step 1: Validate that the template is compatible with the data
    if not target.is_prepared:
        raise NotificationServiceError("Target must have `prepare_targets` called prior to sending")

    # Step 2: Get the provider, and validate the target against it
    provider = provider_registry.get(target.provider_key)
    provider.validate_target(target=target)

    # Step 3: Render the template
    renderer = provider.get_renderer(category=data.category)
    renderable = renderer.render(data=data, template=template)

    # Step 4: Send the notification
    provider.send(target=target, renderable=renderable)


def notify[
    T: NotificationData
](
    *,
    strategy: NotificationStrategy | None = None,
    targets: list[NotificationTarget] | None = None,
    data: T,
    template: NotificationTemplate[T],
) -> None:
    if strategy and targets:
        raise NotificationServiceError(
            "Cannot provide both strategy and targets, only one is permitted. Strategy is preferred."
        )
    if not strategy and not targets:
        raise NotificationServiceError(
            "Must provide either a strategy or targets. Strategy is preferred."
        )

    if strategy:
        targets = strategy.get_targets()

    if not targets:
        logger.info("Strategy '%s' did not yield targets", strategy.__class__.__name__)
        return

    # Prepare the targets for sending by fetching integration data, etc.
    prepare_targets(targets=targets)

    for target in targets:
        _notify_target(target=target, data=data, template=template)

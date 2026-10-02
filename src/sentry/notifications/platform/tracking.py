import logging
from collections.abc import Collection, Mapping
from dataclasses import dataclass
from enum import StrEnum

import sentry_sdk

from sentry import analytics, options
from sentry.analytics.events.notification_tracking import (
    NotificationTrackingEngagementEvent,
    NotificationTrackingSentEvent,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationSource,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class NotificationEngagementMechanism(StrEnum):
    """How an engagement with a notification was observed."""

    PAGE_LOAD = "page_load"
    """A Sentry page loaded from a tracked link."""
    PROVIDER_CALLBACK = "provider_callback"
    """The provider reported an interaction, such as a Slack button press."""
    REDIRECT = "redirect"
    """A tracked link passed through a Sentry redirect to an external destination."""


@dataclass(frozen=True)
class NotificationTrackingContext:
    """
    Identifies a single delivered notification for tracking.

    `source`, `category`, `provider`, and `stage` become metric tags, so each must come from a
    small fixed set of values. IDs and URLs belong in `notification_uuid` and `organization_id`,
    which are only recorded on analytics events.

    Plain strings are accepted for notifications that haven't moved to the notification platform.
    Some of those don't carry a `notification_uuid`.
    """

    source: NotificationSource | str
    provider: NotificationProviderKey | str
    category: NotificationCategory | str
    notification_uuid: str | None
    organization_id: int
    stage: str | None = None


def is_tracking_enabled(
    source: NotificationSource | str, provider: NotificationProviderKey | str
) -> bool:
    """
    Source and provider can come from a URL's `referrer`, so they are checked against known values
    before they become metric tags: the source against the rollout option, and the provider
    against the known providers.
    """
    from sentry.integrations.types import ExternalProviderEnum

    return (
        source in options.get("notifications.tracking.sources") and provider in ExternalProviderEnum
    )


def record_sent(context: NotificationTrackingContext, *, links: Collection[str] = ()) -> None:
    """
    Record that a notification was delivered. `links` names each tracked link or button present
    in the message, which provides the per-link denominator for click-through.
    """
    try:
        if not is_tracking_enabled(context.source, context.provider):
            return

        tags = _get_tags(context)
        _incr("notifications.tracking.sent", tags)
        for link in links:
            _incr("notifications.tracking.link_sent", {**tags, "link": link})

        analytics.record(
            NotificationTrackingSentEvent(
                organization_id=context.organization_id,
                notification_uuid=context.notification_uuid,
                source=context.source,
                category=context.category,
                provider=context.provider,
                stage=context.stage,
                links=list(links),
            )
        )
    except Exception:
        logger.exception(
            "notifications.tracking.record_sent.failed",
            extra={"source": context.source, "provider": context.provider},
        )


def record_engagement(
    context: NotificationTrackingContext,
    *,
    mechanism: NotificationEngagementMechanism,
    link: str,
    user_id: int | None = None,
) -> None:
    """
    Record a click on a link or button in a delivered notification. Each kind of click must be
    recorded by exactly one mechanism so that it is never counted twice. `user_id` is omitted
    when the click isn't authenticated, such as through a redirect.
    """
    try:
        if not is_tracking_enabled(context.source, context.provider):
            return

        _incr(
            "notifications.tracking.engagement",
            {**_get_tags(context), "mechanism": mechanism, "link": link},
        )

        analytics.record(
            NotificationTrackingEngagementEvent(
                organization_id=context.organization_id,
                notification_uuid=context.notification_uuid,
                source=context.source,
                category=context.category,
                provider=context.provider,
                stage=context.stage,
                link=link,
                mechanism=mechanism,
                user_id=user_id,
            )
        )
    except Exception:
        logger.exception(
            "notifications.tracking.record_engagement.failed",
            extra={"source": context.source, "provider": context.provider},
        )


def _get_tags(context: NotificationTrackingContext) -> dict[str, str]:
    tags = {"source": context.source, "provider": context.provider, "category": context.category}
    if context.stage:
        tags["stage"] = context.stage
    return tags


def _incr(key: str, tags: Mapping[str, str]) -> None:
    metrics.incr(key, tags=tags, sample_rate=1.0)
    # The default metrics backend mirrors to Sentry at a low sample rate, so the dashboard reads
    # this unsampled count instead.
    sentry_sdk.metrics.count(key, 1, attributes=dict(tags))

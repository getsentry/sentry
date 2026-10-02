import logging
from collections.abc import Collection, Mapping
from copy import copy
from dataclasses import dataclass, replace
from enum import StrEnum
from typing import NotRequired, TypedDict, cast
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sentry import analytics, options
from sentry.analytics.events.notification_tracking import (
    NotificationTrackingEngagementEvent,
    NotificationTrackingSentEvent,
)
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationCategory,
    NotificationLink,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTextBlock,
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


def decorate_links(
    rendered_template: NotificationRenderedTemplate, *, referrer: str, notification_uuid: str
) -> tuple[NotificationRenderedTemplate, set[NotificationLink]]:
    """
    Adds `referrer`, `notification_uuid`, and `notification_link` (the link's `tracked_as` name) to
    every tracked link in the rendered template, replacing any values already there. Returns the
    decorated template and the names of the links it contains. A link that can't be decorated is
    kept as it was.
    """
    links: set[NotificationLink] = set()

    def decorate(url: str, tracked_as: NotificationLink) -> str:
        try:
            parsed = urlsplit(url)
            query = [
                (key, value)
                for key, value in parse_qsl(parsed.query, keep_blank_values=True)
                if key not in ("referrer", "notification_uuid", "notification_link")
            ]
            query += [
                ("referrer", referrer),
                ("notification_uuid", notification_uuid),
                ("notification_link", tracked_as),
            ]
            decorated = urlunsplit(parsed._replace(query=urlencode(query)))
        except Exception:
            logger.exception("notifications.tracking.decorate_link.failed", extra={"url": url})
            return url
        links.add(tracked_as)
        return decorated

    def decorate_blocks(blocks: list[NotificationTextBlock]) -> list[NotificationTextBlock]:
        return [
            (
                replace(block, url=decorate(block.url, block.tracked_as))
                if isinstance(block, LinkTextBlock) and block.tracked_as
                else block
            )
            for block in blocks
        ]

    def decorate_text(
        text: str | list[NotificationTextBlock],
    ) -> str | list[NotificationTextBlock]:
        return text if isinstance(text, str) else decorate_blocks(text)

    def decorate_section(section: NotificationSection) -> NotificationSection:
        decorated_section = copy(section)
        decorated_section.blocks = decorate_blocks(section.blocks)
        return decorated_section

    decorated = replace(
        rendered_template,
        subject=decorate_text(rendered_template.subject),
        body=[decorate_section(section) for section in rendered_template.body],
        actions=[
            (
                replace(action, link=decorate(action.link, action.tracked_as))
                if action.tracked_as
                else action
            )
            for action in rendered_template.actions
        ],
        footer=(
            None if rendered_template.footer is None else decorate_text(rendered_template.footer)
        ),
    )
    return decorated, links


def record_sent(context: NotificationTrackingContext, *, links: Collection[str] = ()) -> None:
    """
    Record that a notification was delivered. `links` holds the names of the tracked links and
    buttons in the message, which provides the per-link denominator for click-through. A name that
    appears more than once is counted once.
    """
    try:
        if not is_tracking_enabled(context.source, context.provider):
            return

        links = sorted(set(links))
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
                links=links,
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


class _NotificationTrackingTags(TypedDict):
    source: str
    provider: str
    category: str
    stage: NotRequired[str]
    link: NotRequired[str]
    mechanism: NotRequired[NotificationEngagementMechanism]


def _get_tags(context: NotificationTrackingContext) -> _NotificationTrackingTags:
    tags = _NotificationTrackingTags(
        source=context.source, provider=context.provider, category=context.category
    )
    if context.stage:
        tags["stage"] = context.stage
    return tags


def _incr(key: str, tags: _NotificationTrackingTags) -> None:
    metrics.incr(key, tags=cast(Mapping[str, str], tags), sample_rate=1.0)

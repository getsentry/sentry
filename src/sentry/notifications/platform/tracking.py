import logging
import re
from collections.abc import Collection, Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import NotRequired, TypedDict, cast
from urllib.parse import SplitResult, parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit

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

_URL_RE = re.compile(r"https?://[^\s<>'\"\]\)\|]+")


class NotificationLink(StrEnum):
    """What a tracked link points to, inferred from the page it lands on."""

    ISSUE = "issue"
    SEER = "seer"
    """An issue opened with the Seer drawer."""
    ISSUE_LIST = "issue_list"
    ALERT = "alert"
    RELEASE = "release"
    DATA_EXPORT = "data_export"
    SETTINGS = "settings"
    OTHER = "other"


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


def classify_link(url: str) -> NotificationLink:
    """
    Works with both path styles: `/organizations/<slug>/issues/1/` and, on an organization's own
    subdomain, `/issues/1/`.
    """
    parsed = urlsplit(url)
    path = re.sub(r"^/organizations/[^/]+", "", parsed.path)
    query = parse_qs(parsed.query)

    if re.match(r"^/issues/\d+(/|$)", path):
        return (
            NotificationLink.SEER if query.get("seerDrawer") == ["true"] else NotificationLink.ISSUE
        )
    if path.startswith("/issues/"):
        return NotificationLink.ISSUE if "preview" in query else NotificationLink.ISSUE_LIST
    if path.startswith(("/monitors/", "/alerts/")):
        return NotificationLink.ALERT
    if path.startswith("/releases/"):
        return NotificationLink.RELEASE
    if path.startswith("/data-export/"):
        return NotificationLink.DATA_EXPORT
    if path.startswith("/settings/"):
        return NotificationLink.SETTINGS
    return NotificationLink.OTHER


@dataclass
class NotificationLinkDecorator:
    referrer: str
    notification_uuid: str
    links: set[NotificationLink] = field(default_factory=set, init=False)

    def decorate_text(self, text: str) -> str:
        return _URL_RE.sub(lambda match: self.decorate(match.group(0)), text)

    def decorate(self, url: str) -> str:
        try:
            parsed = urlsplit(url)
            if not _is_sentry_url(parsed):
                return url
            query = [
                (key, value)
                for key, value in parse_qsl(parsed.query, keep_blank_values=True)
                if key not in ("referrer", "notification_uuid")
            ]
            query += [
                ("referrer", self.referrer),
                ("notification_uuid", self.notification_uuid),
            ]
            decorated = urlunsplit(parsed._replace(query=urlencode(query)))
            self.links.add(classify_link(url))
            return decorated
        except Exception:
            logger.exception("notifications.tracking.decorate_link.failed", extra={"url": url})
            return url


def _is_sentry_url(parsed: SplitResult) -> bool:
    host = parsed.hostname
    sentry_host = urlsplit(options.get("system.url-prefix")).hostname
    return (
        parsed.scheme in ("http", "https")
        and host is not None
        and sentry_host is not None
        and (host == sentry_host or host.endswith(f".{sentry_host}"))
        and host not in (f"docs.{sentry_host}", f"www.{sentry_host}")
    )


def record_sent(context: NotificationTrackingContext, *, links: Collection[str] = ()) -> None:
    """
    Record that a notification was delivered. `links` names each kind of tracked link or button
    present in the message, which provides the per-link denominator for click-through. A link that
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

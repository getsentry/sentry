import logging
import re
from collections.abc import Collection, Mapping
from copy import copy
from dataclasses import dataclass, field, replace
from enum import StrEnum
from typing import NotRequired, TypedDict, cast
from urllib.parse import SplitResult, parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit

from django.conf import settings

from sentry import analytics, options
from sentry.analytics.events.notification_tracking import (
    NotificationTrackingEngagementEvent,
    NotificationTrackingSentEvent,
)
from sentry.integrations.types import ExternalProviderEnum
from sentry.notifications.platform.types import (
    NOTIFICATION_SOURCE_MAP,
    LinkTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTextBlock,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class NotificationLink(StrEnum):
    """What a tracked link points to, inferred from the page it lands on."""

    ISSUE = "issue"
    ISSUE_WITH_SEER = "issue_with_seer"
    """An issue opened with the Seer drawer."""
    ISSUE_LIST = "issue_list"
    ALERT = "alert"
    RELEASE = "release"
    DATA_EXPORT = "data_export"
    SETTINGS = "settings"
    REPOSITORIES = "repositories"
    SEER_AGENT_RUN = "seer_agent_run"
    INVESTIGATION = "investigation"
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


@dataclass(frozen=True)
class NotificationReferrer:
    """The notification a tracked link came from, as identified by the link's `referrer`."""

    source: NotificationSource
    category: NotificationCategory
    provider: ExternalProviderEnum


_SOURCE_CATEGORIES: dict[str, NotificationCategory] = {
    source: category for category, sources in NOTIFICATION_SOURCE_MAP.items() for source in sources
}

# Legacy notifications built on `BaseNotification` give their links a referrer of
# `<metrics_key>-<provider>`, sometimes followed by `-user` or `-team`, such as
# `assigned_activity-email-user`. Maps each `metrics_key` to the notification platform source that
# replaces it.
_LEGACY_METRICS_KEY_SOURCES: dict[str, NotificationSource] = {
    "issue_alert": NotificationSource.ISSUE,
    "digest": NotificationSource.ISSUE,
    "archived_activity": NotificationSource.ACTIVITY_SET_IGNORED,
    "assigned_activity": NotificationSource.ACTIVITY_ASSIGNED,
    "escalating_activity": NotificationSource.ACTIVITY_SET_ESCALATING,
    "note_activity": NotificationSource.ACTIVITY_NOTE,
    "regression_activity": NotificationSource.ACTIVITY_SET_REGRESSION,
    "release_activity": NotificationSource.DEPLOY_RELEASE,
    "resolved_activity": NotificationSource.ACTIVITY_SET_RESOLVED,
    "resolved_in_commit_activity": NotificationSource.ACTIVITY_SET_RESOLVED_IN_COMMIT,
    "resolved_in_release_activity": NotificationSource.ACTIVITY_SET_RESOLVED_IN_RELEASE,
    "unassigned_activity": NotificationSource.ACTIVITY_UNASSIGNED,
    "unresolved_activity": NotificationSource.ACTIVITY_SET_UNRESOLVED,
}

# Legacy alert referrers, which don't include a `metrics_key`, mapped to the notification platform
# source that replaces them and their provider.
_LEGACY_ALERT_REFERRERS: dict[str, tuple[NotificationSource, str]] = {
    "slack": (NotificationSource.ISSUE, "slack"),
    "msteams": (NotificationSource.ISSUE, "msteams"),
    "discord": (NotificationSource.ISSUE, "discord"),
    "alert_email": (NotificationSource.ISSUE, "email"),
    "metric_alert_email": (NotificationSource.METRIC_ALERT, "email"),
    "metric_alert_slack": (NotificationSource.METRIC_ALERT, "slack"),
    "metric_alert_msteams": (NotificationSource.METRIC_ALERT, "msteams"),
    "metric_alert_discord": (NotificationSource.METRIC_ALERT, "discord"),
    "metric_alert_pagerduty": (NotificationSource.METRIC_ALERT, "pagerduty"),
    "metric_alert_opsgenie": (NotificationSource.METRIC_ALERT, "opsgenie"),
}


def parse_referrer(referrer: str) -> NotificationReferrer | None:
    """
    Identify a notification from a link's `referrer`: `<source>-<provider>` from the notification
    platform, or one of the legacy referrers above. Referrers naming an unknown provider aren't
    recognized.
    """
    prefix, _, provider = referrer.removesuffix("-user").removesuffix("-team").rpartition("-")
    if prefix in _SOURCE_CATEGORIES:
        source = NotificationSource(prefix)
    elif prefix in _LEGACY_METRICS_KEY_SOURCES:
        source = _LEGACY_METRICS_KEY_SOURCES[prefix]
    elif referrer in _LEGACY_ALERT_REFERRERS:
        source, provider = _LEGACY_ALERT_REFERRERS[referrer]
    else:
        return None

    if provider not in ExternalProviderEnum:
        return None
    return NotificationReferrer(source, _SOURCE_CATEGORIES[source], ExternalProviderEnum(provider))


def is_tracking_enabled(
    source: NotificationSource | str, provider: NotificationProviderKey | str
) -> bool:
    """
    Source and provider can come from a URL's `referrer`, so they are checked against known values
    before they become metric tags: the source against the rollout option, and the provider
    against the known providers.
    """
    return (
        source in options.get("notifications.tracking.sources") and provider in ExternalProviderEnum
    )


@dataclass
class NotificationLinkDecorator:
    data: NotificationData
    provider: NotificationProviderKey | str
    links: set[NotificationLink] = field(default_factory=set, init=False)

    def decorate_url(self, url: str) -> str:
        """
        Add tracking parameters to a Sentry URL and include its inferred kind in the set of links
        present in the notification. Other URLs and URLs that can't be decorated are returned
        unchanged and aren't included.
        """
        if not is_tracking_enabled(self.data.source, self.provider):
            return url

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
                ("referrer", f"{self.data.source}-{self.provider}"),
                ("notification_uuid", self.data.notification_uuid),
            ]
            decorated = urlunsplit(parsed._replace(query=urlencode(query)))
        except Exception:
            logger.exception("notifications.tracking.decorate_link.failed", extra={"url": url})
            return url
        self.links.add(classify_link(url))
        return decorated

    def decorate_rendered_template(
        self, rendered_template: NotificationRenderedTemplate
    ) -> NotificationRenderedTemplate:
        if not is_tracking_enabled(self.data.source, self.provider):
            return rendered_template

        def decorate_blocks(blocks: list[NotificationTextBlock]) -> list[NotificationTextBlock]:
            return [
                replace(block, url=self.decorate_url(block.url))
                if isinstance(block, LinkTextBlock)
                else block
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

        return replace(
            rendered_template,
            subject=decorate_text(rendered_template.subject),
            body=[decorate_section(section) for section in rendered_template.body],
            actions=[
                replace(action, link=self.decorate_url(action.link))
                for action in rendered_template.actions
            ],
            footer=(
                None
                if rendered_template.footer is None
                else decorate_text(rendered_template.footer)
            ),
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
            NotificationLink.ISSUE_WITH_SEER
            if query.get("seerDrawer") == ["true"]
            else NotificationLink.ISSUE
        )
    if path.startswith(("/monitors/", "/alerts/", "/issues/alerts/")):
        return NotificationLink.ALERT
    if path.startswith("/issues/"):
        return NotificationLink.ISSUE if "preview" in query else NotificationLink.ISSUE_LIST
    if path.startswith("/releases/"):
        return NotificationLink.RELEASE
    if path.startswith("/data-export/"):
        return NotificationLink.DATA_EXPORT
    if path.startswith("/settings/"):
        return NotificationLink.SETTINGS
    if path.startswith("/repos/"):
        return NotificationLink.REPOSITORIES
    if path.startswith("/explore/agents/conversations/"):
        return NotificationLink.SEER_AGENT_RUN
    if path.startswith("/explore/investigations/"):
        return NotificationLink.INVESTIGATION
    logger.error("notifications.tracking.unclassified_link", extra={"path": path})
    return NotificationLink.OTHER


def _is_sentry_url(parsed: SplitResult) -> bool:
    host = parsed.hostname
    if parsed.scheme not in ("http", "https") or host is None:
        return False
    sentry_hosts = set()
    if url_prefix_host := urlsplit(options.get("system.url-prefix")).hostname:
        sentry_hosts.add(url_prefix_host)
    # On a region, such as `us.sentry.io`, organization links are on `<slug>.sentry.io`, which
    # isn't under the region's own host.
    if org_base_hostname := settings.SENTRY_ORGANIZATION_BASE_HOSTNAME:
        if org_host := urlsplit(f"//{org_base_hostname.removeprefix('{slug}.')}").hostname:
            sentry_hosts.add(org_host)
    if host in {f"{subdomain}.{h}" for h in sentry_hosts for subdomain in ("docs", "www")}:
        return False
    return any(host == h or host.endswith(f".{h}") for h in sentry_hosts)


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

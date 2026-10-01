from __future__ import annotations

import logging
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from sentry import options
from sentry.incidents.models.incident import INCIDENT_STATUS
from sentry.incidents.typings.metric_detector import MetricIssueContext
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.notifications.platform.shadow.compare import report
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationSource,
)
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.ratelimits import backend as ratelimiter
from sentry.services.eventstore.models import GroupEvent
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)

SHADOW_PROVIDERS: dict[str, NotificationProviderKey] = {
    Action.Type.SLACK: NotificationProviderKey.SLACK,
    Action.Type.SLACK_STAGING: NotificationProviderKey.SLACK_STAGING,
    Action.Type.DISCORD: NotificationProviderKey.DISCORD,
    Action.Type.MSTEAMS: NotificationProviderKey.MSTEAMS,
}

SHADOW_SOURCES = frozenset({NotificationSource.ISSUE, NotificationSource.METRIC_ALERT})


@dataclass(frozen=True)
class LegacyRender:
    provider: NotificationProviderKey
    payload: Mapping[str, Any]
    chart_url: str | None


@dataclass
class ShadowCollector:
    """
    Holds the payload the legacy send path handed to the provider while a shadow read is active.
    """

    legacy_render: LegacyRender | None = None


_active_collector: ContextVar[ShadowCollector | None] = ContextVar(
    "notification_platform_shadow_collector", default=None
)

type BuildPlatformData = Callable[[LegacyRender], NotificationData]


def _variant(
    invocation: ActionInvocation, source: NotificationSource, provider_key: NotificationProviderKey
) -> str:
    """
    Names the combination of source, provider, and the invocation attributes the legacy renderers
    branch on, e.g. `issue:slack:error:event:tags:no_notes:unresolved:new:no_env`.
    """
    group = invocation.event_data.group
    event = invocation.event_data.event
    notes = "notes" if invocation.action.data.get("notes") else "no_notes"
    if source == NotificationSource.ISSUE:
        has_occurrence = isinstance(event, GroupEvent) and event.occurrence_id is not None
        parts = [
            group.issue_type.slug,
            "occurrence" if has_occurrence else "event",
            "tags" if invocation.action.data.get("tags") else "no_tags",
            notes,
            {GroupStatus.RESOLVED: "resolved", GroupStatus.IGNORED: "ignored"}.get(
                group.status, "unresolved"
            ),
            "new" if group.substatus == GroupSubStatus.NEW else "not_new",
            "env" if invocation.event_data.workflow_env is not None else "no_env",
        ]
    else:
        _, priority = IssueNotificationContext(invocation).evidence_data_and_priority
        parts = [
            INCIDENT_STATUS[MetricIssueContext._get_new_status(group, priority)].lower(),
            "activity" if isinstance(event, Activity) else "occurrence",
            notes,
            str(invocation.detector.config.get("detection_type")),
        ]
    return ":".join([source.value, provider_key.value, *parts])


def _sampled_variant(
    invocation: ActionInvocation, source: NotificationSource, provider_key: NotificationProviderKey
) -> str | None:
    """
    Returns the invocation's variant if it is among the first
    `notifications.platform.shadow-render.variant-daily-limit` invocations of that variant today,
    otherwise None.
    """
    try:
        if (
            source not in SHADOW_SOURCES
            or invocation.workflow_id == TEST_NOTIFICATION_ID
            or invocation.action.id == TEST_NOTIFICATION_ID
        ):
            return None
        limit = options.get("notifications.platform.shadow-render.variant-daily-limit")
        if limit <= 0:
            return None
        variant = _variant(invocation, source, provider_key)
        if ratelimiter.is_limited(
            f"notifications.platform.shadow:{variant}", limit, window=24 * 60 * 60
        ):
            return None
        return variant
    except Exception:
        logger.exception("notifications.platform.shadow.sample_failed", extra={"source": source})
        return None


@contextmanager
def collecting() -> Generator[ShadowCollector]:
    collector = ShadowCollector()
    token = _active_collector.set(collector)
    try:
        yield collector
    finally:
        _active_collector.reset(token)


def record_legacy_render(
    provider: NotificationProviderKey,
    payload: Mapping[str, Any],
    *,
    chart_url: str | None = None,
) -> None:
    """
    Records the final payload of a legacy alert send. Call it once the payload is built and before
    it is sent. Only the first render in a shadow read is kept, it does nothing when no shadow read
    is active, and it never raises.
    """
    try:
        collector = _active_collector.get()
        if collector is None or collector.legacy_render is not None:
            return
        collector.legacy_render = LegacyRender(
            provider=provider, payload=payload, chart_url=chart_url
        )
    except Exception:
        logger.exception(
            "notifications.platform.shadow.record_failed", extra={"provider": str(provider)}
        )


@contextmanager
def shadow_read(
    invocation: ActionInvocation, source: NotificationSource, build_data: BuildPlatformData
) -> Generator[None]:
    """
    Wraps a legacy alert send. When the invocation is sampled, the payload the legacy path sends is
    captured, and once the send returns or raises an `Exception`, `build_data` turns that capture
    into the data the notification platform renders, and the two payloads are compared.
    `build_data` is only called when a legacy payload was captured.

    The shadow never raises into the send, and an exception from the send propagates unchanged.
    """
    provider_key = SHADOW_PROVIDERS.get(invocation.action.type)
    if (
        provider_key is None
        or (variant := _sampled_variant(invocation, source, provider_key)) is None
    ):
        yield
        return

    try:
        with collecting() as collector:
            yield
    except Exception:
        report(invocation, source, provider_key, variant, collector.legacy_render, build_data)
        raise
    report(invocation, source, provider_key, variant, collector.legacy_render, build_data)

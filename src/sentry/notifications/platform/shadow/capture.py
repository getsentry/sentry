from __future__ import annotations

import logging
from collections.abc import Generator, Mapping, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from sentry.notifications.platform.types import NotificationProviderKey

if TYPE_CHECKING:
    from sentry.notifications.utils.issue_notification_context import IssueNotificationContext

logger = logging.getLogger(__name__)

type SlackAttachmentsAndText = tuple[str | Sequence[Mapping[str, Any]], str]
type ShadowPayload = Mapping[str, Any] | SlackAttachmentsAndText


@dataclass(frozen=True)
class LegacyRender:
    provider: NotificationProviderKey
    payload: ShadowPayload
    chart_url: str | None


@dataclass
class ShadowCollector:
    """
    Holds what the legacy send path produced while a shadow read is active: the payload handed to
    the provider, the metric alert context it was built from, and whether the notification
    platform sent the alert instead.
    """

    legacy: LegacyRender | None = None
    metric_context: IssueNotificationContext | None = None
    platform_sent: bool = False


_active_collector: ContextVar[ShadowCollector | None] = ContextVar(
    "notifications_platform_shadow_collector", default=None
)


def is_collecting() -> bool:
    return _active_collector.get() is not None


@contextmanager
def collecting(collector: ShadowCollector) -> Generator[ShadowCollector]:
    token = _active_collector.set(collector)
    try:
        yield collector
    finally:
        _active_collector.reset(token)


def record_legacy_render(
    provider: NotificationProviderKey,
    payload: ShadowPayload,
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
        if collector is None or collector.legacy is not None:
            return
        collector.legacy = LegacyRender(provider=provider, payload=payload, chart_url=chart_url)
    except Exception:
        logger.exception(
            "notifications.platform.shadow.record_failed", extra={"provider": str(provider)}
        )


def record_metric_alert_context(context: IssueNotificationContext) -> None:
    """
    Records the context a legacy metric alert send was built from, so the platform render can
    reuse it. Does nothing when no shadow read is active, and never raises.
    """
    try:
        collector = _active_collector.get()
        if collector is None or collector.metric_context is not None:
            return
        collector.metric_context = context
    except Exception:
        logger.exception("notifications.platform.shadow.record_failed")


def record_platform_send() -> None:
    """
    Marks the alert as sent through the notification platform rather than the legacy path, so the
    shadow read has nothing to compare. Does nothing when no shadow read is active, and never raises.
    """
    try:
        collector = _active_collector.get()
        if collector is not None:
            collector.platform_sent = True
    except Exception:
        logger.exception("notifications.platform.shadow.record_failed")

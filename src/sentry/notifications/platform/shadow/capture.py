from __future__ import annotations

import logging
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from sentry.notifications.platform.types import NotificationProviderKey

logger = logging.getLogger(__name__)

type ShadowPayload = Mapping[str, Any] | tuple[str, str]


@dataclass(frozen=True)
class LegacyRender:
    provider: NotificationProviderKey
    payload: ShadowPayload
    chart_url: str | None


@dataclass
class ShadowCollector:
    """
    Holds the payload the legacy send path handed to the provider while a shadow read is active.
    """

    legacy_render: LegacyRender | None = None


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
        if collector is None or collector.legacy_render is not None:
            return
        collector.legacy_render = LegacyRender(
            provider=provider, payload=payload, chart_url=chart_url
        )
    except Exception:
        logger.exception(
            "notifications.platform.shadow.record_failed", extra={"provider": str(provider)}
        )

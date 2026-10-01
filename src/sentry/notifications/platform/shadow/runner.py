from __future__ import annotations

import logging
import random
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import sentry_sdk

from sentry import options
from sentry.notifications.platform.registry import (
    provider_registry,
    renderer_registry,
    template_registry,
)
from sentry.notifications.platform.service import KILLSWITCH_OPTION_KEY, NotificationService
from sentry.notifications.platform.shadow.capture import (
    LegacyRender,
    ShadowCollector,
    collecting,
)
from sentry.notifications.platform.shadow.normalize import normalize
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationSource,
)
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.utils import metrics
from sentry.utils.payload_comparison import ParityChecker, describe_value
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)

SAMPLE_RATES_OPTION_KEY = "notifications.platform.shadow-render.sample-rates"
MAX_DIFF_ENTRIES_OPTION_KEY = "notifications.platform.shadow-render.max-diff-entries"

SHADOW_PROVIDERS: dict[str, NotificationProviderKey] = {
    Action.Type.SLACK: NotificationProviderKey.SLACK,
    Action.Type.SLACK_STAGING: NotificationProviderKey.SLACK_STAGING,
    Action.Type.DISCORD: NotificationProviderKey.DISCORD,
    Action.Type.MSTEAMS: NotificationProviderKey.MSTEAMS,
}

SHADOW_SOURCES = frozenset({NotificationSource.ISSUE, NotificationSource.METRIC_ALERT})

type BuildPlatformData = Callable[[LegacyRender], NotificationData]


class ShadowOutcome(StrEnum):
    MATCH = "match"
    MISMATCH = "mismatch"
    LEGACY_NOT_CAPTURED = "legacy_not_captured"
    NO_RENDERER = "no_renderer"
    PLATFORM_ERROR = "platform_error"
    COMPARE_ERROR = "compare_error"


@dataclass(frozen=True)
class ShadowResult:
    outcome: ShadowOutcome
    diff: list[str] = field(default_factory=list)


def _should_shadow(invocation: ActionInvocation, source: NotificationSource) -> bool:
    try:
        return (
            source in SHADOW_SOURCES
            and invocation.workflow_id != TEST_NOTIFICATION_ID
            and invocation.action.id != TEST_NOTIFICATION_ID
            and source.value not in options.get(KILLSWITCH_OPTION_KEY)
            and random.random() < float(options.get(SAMPLE_RATES_OPTION_KEY).get(source.value, 0.0))
        )
    except Exception:
        logger.exception("notifications.platform.shadow.sample_failed", extra={"source": source})
        return False


def _capture_shadow_error(
    error: Exception,
    outcome: ShadowOutcome,
    source: NotificationSource,
    provider_key: NotificationProviderKey,
) -> ShadowResult:
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("shadow", outcome.value)
        scope.set_tag("notification_source", source.value)
        scope.set_tag("notification_provider", provider_key.value)
        sentry_sdk.capture_exception(error)
    return ShadowResult(outcome=outcome)


def _diff(legacy: Mapping[str, Any], platform: Mapping[str, Any]) -> list[str]:
    """
    Describes each difference between two normalized payloads, with legacy as "old" and platform
    as "new". Payloads carry customer data, so values are summarized by `describe_value` rather
    than included.
    """
    checker = ParityChecker(format_value=describe_value)
    checker.compare(legacy, platform, frozenset())
    return checker.mismatches


def _compare_with_platform(
    source: NotificationSource,
    provider_key: NotificationProviderKey,
    collector: ShadowCollector,
    build_data: BuildPlatformData,
) -> ShadowResult:
    """
    Renders the invocation through the notification platform and diffs it against the legacy
    payload in the collector.
    """
    provider = provider_registry.get(provider_key)
    renderer_key = provider.renderer_key or provider.key
    if renderer_registry.get(provider_key=renderer_key, source=source) is None:
        return ShadowResult(outcome=ShadowOutcome.NO_RENDERER)
    legacy_render = collector.legacy_render
    if legacy_render is None:
        return ShadowResult(outcome=ShadowOutcome.LEGACY_NOT_CAPTURED)

    try:
        data = build_data(legacy_render)
        platform_payload = NotificationService.render_template(
            data=data, template=template_registry.get(data.source)(), provider=provider
        )
    except Exception as e:
        return _capture_shadow_error(e, ShadowOutcome.PLATFORM_ERROR, source, provider_key)

    try:
        entries = _diff(
            normalize(legacy_render.provider, legacy_render.payload),
            normalize(provider_key, platform_payload),
        )
    except Exception as e:
        return _capture_shadow_error(e, ShadowOutcome.COMPARE_ERROR, source, provider_key)

    if not entries:
        return ShadowResult(outcome=ShadowOutcome.MATCH)
    return ShadowResult(outcome=ShadowOutcome.MISMATCH, diff=entries)


def _report(
    invocation: ActionInvocation,
    source: NotificationSource,
    provider_key: NotificationProviderKey,
    collector: ShadowCollector,
    build_data: BuildPlatformData,
) -> None:
    log_extra: dict[str, Any] = {
        "source": source.value,
        "provider": provider_key.value,
        "action_id": invocation.action.id,
        "workflow_id": invocation.workflow_id,
    }
    try:
        tags = {"source": source.value, "provider": provider_key.value}
        with metrics.timer(
            "notifications.platform.shadow.duration", tags=tags, sample_rate=1.0
        ) as timer_tags:
            result = _compare_with_platform(source, provider_key, collector, build_data)
            timer_tags["outcome"] = result.outcome.value
        metrics.incr(
            "notifications.platform.shadow.result",
            tags={**tags, "outcome": result.outcome.value},
            sample_rate=1.0,
        )

        if result.outcome == ShadowOutcome.MISMATCH:
            max_entries = options.get(MAX_DIFF_ENTRIES_OPTION_KEY)
            logger.info(
                "notifications.platform.shadow.mismatch",
                extra={
                    **log_extra,
                    "organization_id": invocation.detector.linked_project.organization_id,
                    "group_id": invocation.event_data.group.id,
                    "detector_id": invocation.detector.id,
                    "diff_count": len(result.diff),
                    "diff": result.diff[:max_entries],
                },
            )
    except Exception:
        logger.exception("notifications.platform.shadow.report_failed", extra=log_extra)


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
    if provider_key is None or not _should_shadow(invocation, source):
        yield
        return

    try:
        with collecting() as collector:
            yield
    except Exception:
        _report(invocation, source, provider_key, collector, build_data)
        raise
    _report(invocation, source, provider_key, collector, build_data)

from __future__ import annotations

import logging
import random
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
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
    is_collecting,
)
from sentry.notifications.platform.shadow.compare import DiffEntry, diff, normalize
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationSource,
)
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.notifications.utils.issue_notification_context import IssueNotificationContext
from sentry.utils import metrics
from sentry.utils.registry import NoRegistrationExistsError
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


class ShadowOutcome(StrEnum):
    MATCH = "match"
    MISMATCH = "mismatch"
    LEGACY_NOT_CAPTURED = "legacy_not_captured"
    PLATFORM_SENT = "platform_sent"
    NO_RENDERER = "no_renderer"
    PLATFORM_ERROR = "platform_error"
    COMPARE_ERROR = "compare_error"


@dataclass(frozen=True)
class ShadowResult:
    outcome: ShadowOutcome
    diff: list[DiffEntry] = field(default_factory=list)


def _is_test_notification(invocation: ActionInvocation) -> bool:
    return (
        invocation.workflow_id == TEST_NOTIFICATION_ID
        or invocation.action.id == TEST_NOTIFICATION_ID
    )


def _should_shadow(invocation: ActionInvocation, source: NotificationSource) -> bool:
    try:
        if is_collecting() or source not in SHADOW_SOURCES or _is_test_notification(invocation):
            return False
        if source.value in options.get(KILLSWITCH_OPTION_KEY):
            return False
        rate = options.get(SAMPLE_RATES_OPTION_KEY).get(source.value, 0.0)
        return random.random() < float(rate)
    except Exception:
        logger.exception("notifications.platform.shadow.sample_failed", extra={"source": source})
        return False


def _has_platform_renderer(
    provider_key: NotificationProviderKey, source: NotificationSource
) -> bool:
    try:
        provider = provider_registry.get(provider_key)
    except NoRegistrationExistsError:
        return False
    renderer_key = provider.renderer_key or provider.key
    return renderer_registry.get(provider_key=renderer_key, source=source) is not None


def _render_platform(
    invocation: ActionInvocation,
    source: NotificationSource,
    provider_key: NotificationProviderKey,
    collector: ShadowCollector,
    legacy: LegacyRender,
) -> Any:
    from sentry.notifications.notification_action.utils import (
        issue_notification_data_factory,
        metric_alert_notification_data_factory,
    )

    data: NotificationData
    if source == NotificationSource.METRIC_ALERT:
        context = collector.metric_context or IssueNotificationContext(invocation)
        data = metric_alert_notification_data_factory(context, chart_url=legacy.chart_url)
    else:
        data = issue_notification_data_factory(invocation)

    return NotificationService.render_template(
        data=data,
        template=template_registry.get(data.source)(),
        provider=provider_registry.get(provider_key),
    )


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


def compare_with_platform(
    invocation: ActionInvocation,
    source: NotificationSource,
    provider_key: NotificationProviderKey,
    collector: ShadowCollector,
) -> ShadowResult:
    """
    Renders the invocation through the notification platform and diffs it against the legacy
    payload in the collector.
    """
    if collector.platform_sent:
        return ShadowResult(outcome=ShadowOutcome.PLATFORM_SENT)
    if not _has_platform_renderer(provider_key, source):
        return ShadowResult(outcome=ShadowOutcome.NO_RENDERER)
    legacy = collector.legacy
    if legacy is None:
        return ShadowResult(outcome=ShadowOutcome.LEGACY_NOT_CAPTURED)

    try:
        platform_payload = _render_platform(invocation, source, provider_key, collector, legacy)
    except Exception as e:
        return _capture_shadow_error(e, ShadowOutcome.PLATFORM_ERROR, source, provider_key)

    try:
        entries = diff(
            normalize(legacy.provider, source, legacy.payload),
            normalize(provider_key, source, platform_payload),
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
            result = compare_with_platform(invocation, source, provider_key, collector)
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
                    "diff": [asdict(entry) for entry in result.diff[:max_entries]],
                },
            )
    except Exception:
        logger.exception("notifications.platform.shadow.report_failed", extra=log_extra)


@contextmanager
def shadow_read(invocation: ActionInvocation, source: NotificationSource) -> Generator[None]:
    """
    Wraps a legacy alert send. When the invocation is sampled, the payload the legacy path sends is
    captured, and once the send returns or raises an `Exception`, the same invocation is rendered
    through the notification platform and the two payloads are compared.

    The shadow never raises into the send, and an exception from the send propagates unchanged.
    Nested shadow reads are no-ops, so an alert is compared at most once.
    """
    provider_key = SHADOW_PROVIDERS.get(invocation.action.type)
    if provider_key is None or not _should_shadow(invocation, source):
        yield
        return

    collector = ShadowCollector()
    try:
        with collecting(collector):
            yield
    except Exception:
        _report(invocation, source, provider_key, collector)
        raise
    _report(invocation, source, provider_key, collector)

from __future__ import annotations

import logging
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import orjson
import sentry_sdk
from slack_sdk.models.blocks import Block

from sentry import options
from sentry.incidents.models.incident import INCIDENT_STATUS
from sentry.incidents.typings.metric_detector import MetricIssueContext
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
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
from sentry.utils import metrics
from sentry.utils.payload_comparison import ParityChecker, describe_value
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
            or source.value in options.get(KILLSWITCH_OPTION_KEY)
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


def _as_list(value: Any) -> list[Any]:
    if not value:
        return []
    if isinstance(value, (str, bytes)):
        return orjson.loads(value)
    return [item.to_dict() if isinstance(item, Block) else item for item in value]


def _without_integration_id(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: _without_integration_id(v) for k, v in value.items() if k != "integrationId"}
    if isinstance(value, (list, tuple)):
        return [_without_integration_id(v) for v in value]
    return value


def _normalize(provider: NotificationProviderKey, payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """
    Puts a legacy or platform payload into the shape the provider receives. Slack keeps only the
    keys `chat.postMessage` is sent, with JSON strings parsed. MS Teams drops `integrationId` from
    action payloads: only legacy cards include it, and the webhook doesn't rely on it.
    """
    if provider in (NotificationProviderKey.SLACK, NotificationProviderKey.SLACK_STAGING):
        return {
            "blocks": _as_list(payload.get("blocks")),
            "attachments": _as_list(payload.get("attachments")),
            "text": payload.get("text") or "",
        }
    if provider == NotificationProviderKey.MSTEAMS:
        return _without_integration_id(payload)
    return payload


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
            _normalize(legacy_render.provider, legacy_render.payload),
            _normalize(provider_key, platform_payload),
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
    variant: str,
    collector: ShadowCollector,
    build_data: BuildPlatformData,
) -> None:
    log_extra: dict[str, Any] = {
        "source": source.value,
        "provider": provider_key.value,
        "variant": variant,
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
            logger.info(
                "notifications.platform.shadow.mismatch",
                extra={
                    **log_extra,
                    "organization_id": invocation.detector.linked_project.organization_id,
                    "group_id": invocation.event_data.group.id,
                    "detector_id": invocation.detector.id,
                    "diff_count": len(result.diff),
                    "diff": result.diff,
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
        _report(invocation, source, provider_key, variant, collector, build_data)
        raise
    _report(invocation, source, provider_key, variant, collector, build_data)

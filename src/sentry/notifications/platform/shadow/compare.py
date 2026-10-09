from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING, Any

import orjson
import sentry_sdk
from slack_sdk.models.blocks import Block

from sentry.models.group import Group
from sentry.notifications.platform.registry import (
    provider_registry,
    renderer_registry,
    template_registry,
)
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.utils import metrics
from sentry.utils.payload_comparison import ParityChecker, describe_value
from sentry.workflow_engine.types import ActionInvocation

if TYPE_CHECKING:
    from sentry.notifications.platform.shadow.capture import BuildPlatformData, LegacyRender

logger = logging.getLogger(__name__)


class ShadowOutcome(StrEnum):
    MATCH = "match"
    MISMATCH = "mismatch"
    LEGACY_NOT_CAPTURED = "legacy_not_captured"
    GROUP_CHANGED = "group_changed"
    NO_RENDERER = "no_renderer"
    PLATFORM_ERROR = "platform_error"
    COMPARE_ERROR = "compare_error"


@dataclass(frozen=True)
class ShadowResult:
    outcome: ShadowOutcome
    diff: list[str] = field(default_factory=list)


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


def _group_changed(invocation: ActionInvocation) -> bool:
    """
    Whether the group state the issue renderers read has changed since the invocation loaded the
    group. Issue renderers re-read the group from cache, so a change would show up as a diff.
    """
    group = invocation.event_data.group
    try:
        current = Group.objects.get_from_cache(id=group.id)
    except Group.DoesNotExist:
        return True

    event_datetime = getattr(invocation.event_data.event, "datetime", None)

    def state(g: Group) -> tuple[object, ...]:
        last_seen = max(g.last_seen, event_datetime) if event_datetime else g.last_seen
        return (g.status, g.substatus, last_seen)

    return state(current) != state(group)


def _compare_with_platform(
    invocation: ActionInvocation,
    source: NotificationSource,
    provider_key: NotificationProviderKey,
    legacy_render: LegacyRender | None,
    build_data: BuildPlatformData,
) -> ShadowResult:
    """
    Renders the invocation through the notification platform and diffs it against the legacy
    render.
    """
    provider = provider_registry.get(provider_key)
    renderer_key = provider.renderer_key or provider.key
    if renderer_registry.get(provider_key=renderer_key, source=source) is None:
        return ShadowResult(outcome=ShadowOutcome.NO_RENDERER)
    if legacy_render is None:
        return ShadowResult(outcome=ShadowOutcome.LEGACY_NOT_CAPTURED)
    if source == NotificationSource.ISSUE and _group_changed(invocation):
        return ShadowResult(outcome=ShadowOutcome.GROUP_CHANGED)

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


def _invocation_log_extra(invocation: ActionInvocation) -> dict[str, Any]:
    return {
        "organization_id": invocation.detector.linked_project.organization_id,
        "group_id": invocation.event_data.group.id,
        "detector_id": invocation.detector.id,
    }


def _render_traits(
    invocation: ActionInvocation, source: NotificationSource, legacy_render: LegacyRender
) -> dict[str, bool]:
    """
    Flags which optional branches the legacy render took, so coverage of branches the variant
    doesn't name can be read from the logs. Slack issue alert flags are read from the payload
    itself, since their inputs are expensive to recompute.
    """
    traits = {
        "has_releases": bool(invocation.detector.linked_project.flags.has_releases),
        "has_chart": legacy_render.chart_url is not None,
    }
    if source == NotificationSource.ISSUE and legacy_render.provider in (
        NotificationProviderKey.SLACK,
        NotificationProviderKey.SLACK_STAGING,
    ):
        blocks = _normalize(legacy_render.provider, legacy_render.payload)["blocks"]
        context_texts = [
            element.get("text", "")
            for block in blocks
            if block.get("type") == "context"
            for element in block.get("elements", [])
        ]
        buttons = [
            element
            for block in blocks
            if block.get("type") == "actions"
            for element in block.get("elements", [])
        ]
        traits["has_chart"] |= any(block.get("type") == "image" for block in blocks)
        traits["has_suggested_assignees"] = any("Suggested: " in text for text in context_texts)
        traits["has_replay_link"] = any("View Replays" in text for text in context_texts)
        traits["has_autofix_button"] = any(
            button.get("value") == AutofixStoppingPoint.ROOT_CAUSE for button in buttons
        )
    return traits


def report(
    invocation: ActionInvocation,
    source: NotificationSource,
    provider_key: NotificationProviderKey,
    variant: str,
    legacy_render: LegacyRender | None,
    build_data: BuildPlatformData,
) -> None:
    """
    Compares the legacy render with the platform's and records the outcome as a metric and a log
    line, which also carries the diff on a mismatch. Never raises.
    """
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
            result = _compare_with_platform(
                invocation, source, provider_key, legacy_render, build_data
            )
            timer_tags["outcome"] = result.outcome.value
        metrics.incr(
            "notifications.platform.shadow.result",
            tags={**tags, "outcome": result.outcome.value},
            sample_rate=1.0,
        )

        result_extra: dict[str, Any] = {
            **log_extra,
            **_invocation_log_extra(invocation),
            "outcome": result.outcome.value,
        }
        if result.outcome == ShadowOutcome.MISMATCH:
            result_extra["diff_count"] = len(result.diff)
            result_extra["diff"] = result.diff
        elif result.outcome == ShadowOutcome.LEGACY_NOT_CAPTURED:
            result_extra["integration_id"] = invocation.action.integration_id
        if legacy_render is not None:
            try:
                result_extra.update(_render_traits(invocation, source, legacy_render))
            except Exception:
                logger.exception("notifications.platform.shadow.traits_failed", extra=log_extra)
        logger.info("notifications.platform.shadow.result", extra=result_extra)
    except Exception:
        logger.exception("notifications.platform.shadow.report_failed", extra=log_extra)

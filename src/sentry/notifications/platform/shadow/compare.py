from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING, Any

import orjson
import sentry_sdk
from slack_sdk.models.blocks import Block

from sentry.issues.grouptype import NotificationContextField
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


# Slack issue alerts show live group stats, such as `Events: *12*`, that can change between the
# legacy render and the platform render.
_GROUP_STATS = re.compile(
    "(?P<label>{}): \\*(?P<value>[^*]*)\\*".format(
        "|".join(
            re.escape(field)
            for field in (
                NotificationContextField.EVENTS,
                NotificationContextField.USERS_AFFECTED,
                NotificationContextField.FIRST_SEEN,
                NotificationContextField.APPROX_START_TIME,
            )
        )
    )
)
_DIGITS = re.compile(r"\d+")


# `get_context` leaves out the event and user counts while a group has at most one event.
_COUNT_STAT = re.compile(
    "(?:{}): \\*".format(
        "|".join(
            re.escape(field)
            for field in (NotificationContextField.EVENTS, NotificationContextField.USERS_AFFECTED)
        )
    )
)
_STAT_SEPARATOR = "   "


def _is_relative_time(value: str) -> bool:
    """
    Whether a value is one of `time_since`'s relative times, such as `Just now` or `2 hours ago`.
    Renders made a second apart can cross a unit, as from `Just now` to `1 minute ago`.
    """
    return value in ("Just now", "Yesterday") or value.endswith(" ago")


def _mask_group_stats(
    payload: Mapping[str, Any], *, ignore_counts: bool = False
) -> Mapping[str, Any]:
    """
    Replaces the digits in the group stats of a normalized Slack payload's context blocks, so two
    renders that differ only by a count or elapsed time compare equal. Labels and non-numeric
    values are kept, so a stat that is added, dropped, or reworded still shows up as a diff, except
    for relative first-seen times, which are masked whole. `ignore_counts` also removes the event
    and user counts, for groups whose count is at the threshold where `get_context` starts showing
    them.
    """

    def mask(match: re.Match[str]) -> str:
        value = match["value"]
        if match["label"] == NotificationContextField.FIRST_SEEN and _is_relative_time(value):
            return f"{match['label']}: *relative*"
        return f"{match['label']}: *{_DIGITS.sub('#', value)}*"

    def mask_text(text: str) -> str:
        if ignore_counts:
            text = _STAT_SEPARATOR.join(
                stat for stat in text.split(_STAT_SEPARATOR) if not _COUNT_STAT.match(stat)
            )
        return _GROUP_STATS.sub(mask, text)

    def mask_element(element: Any) -> Any:
        if isinstance(element, Mapping) and isinstance(element.get("text"), str):
            return {**element, "text": mask_text(element["text"])}
        return element

    blocks = [
        (
            {**block, "elements": [mask_element(e) for e in block.get("elements", [])]}
            if isinstance(block, Mapping) and block.get("type") == "context"
            else block
        )
        for block in payload.get("blocks", [])
    ]
    return {**payload, "blocks": blocks}


def _at_single_event(invocation: ActionInvocation) -> bool:
    """
    Whether the invocation's group or its cached copy has at most one event written to the
    database. Its next events are still in the buffer, so the count each render reads depends on
    when it reads it, and one render can show the event and user counts while the other leaves
    them out.
    """
    group = invocation.event_data.group
    try:
        cached = Group.objects.get_from_cache(id=group.id)
    except Group.DoesNotExist:
        return False
    return min(group.times_seen, cached.times_seen) <= 1


def _only_group_stats_differ(
    invocation: ActionInvocation,
    provider: NotificationProviderKey,
    legacy: Mapping[str, Any],
    platform: Mapping[str, Any],
) -> bool:
    if provider not in (NotificationProviderKey.SLACK, NotificationProviderKey.SLACK_STAGING):
        return False
    if not _diff(_mask_group_stats(legacy), _mask_group_stats(platform)):
        return True
    return _at_single_event(invocation) and not _diff(
        _mask_group_stats(legacy, ignore_counts=True),
        _mask_group_stats(platform, ignore_counts=True),
    )


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
        platform_payload, _ = NotificationService.render_template(
            data=data, template=template_registry.get(data.source)(), provider=provider
        )
    except Exception as e:
        return _capture_shadow_error(e, ShadowOutcome.PLATFORM_ERROR, source, provider_key)

    try:
        legacy = _normalize(legacy_render.provider, legacy_render.payload)
        platform = _normalize(provider_key, platform_payload)
        entries = _diff(legacy, platform)
        stats_only = (
            bool(entries)
            and source == NotificationSource.ISSUE
            and _only_group_stats_differ(invocation, provider_key, legacy, platform)
        )
    except Exception as e:
        return _capture_shadow_error(e, ShadowOutcome.COMPARE_ERROR, source, provider_key)

    if not entries:
        return ShadowResult(outcome=ShadowOutcome.MATCH)
    # Stats drift is the same race `_group_changed` catches, in values it doesn't compare.
    if stats_only:
        return ShadowResult(outcome=ShadowOutcome.GROUP_CHANGED)
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

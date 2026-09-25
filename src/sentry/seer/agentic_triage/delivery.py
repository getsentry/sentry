"""Delivery handler for agentic triage results from Seer."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import sentry_sdk

from sentry import features
from sentry.api.serializers import EventSerializer, serialize
from sentry.constants import SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT, ObjectStatus
from sentry.eventstore import backend as eventstore
from sentry.issues.action_log import SYSTEM_ACTOR, ActionSource, action_context_scope
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.agentic_triage.models import TriageResponse, TriageVerdict
from sentry.seer.autofix.autofix_agent import trigger_autofix_agent
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.issue_summary import referrer_map
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    bulk_read_preferences_from_sentry_db,
    is_seer_autotriggered_autofix_rate_limited_and_increment,
    is_seer_seat_based_tier_enabled,
)
from sentry.seer.models.agentic_triage import (
    SeerAgenticTriageRunErrorType,
    SeerAgenticTriageRunResult,
)
from sentry.seer.models.autofix_issue_data import SeerAutofixIssueData
from sentry.seer.models.run import SeerRun
from sentry.seer.models.workflow import (
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowStrategy,
)
from sentry.tasks.seer.agentic_triage.models import TriageAction
from sentry.tasks.seer.agentic_triage.skip_cache import mark_skipped
from sentry.types.activity import ActivityType
from sentry.utils import json

logger = logging.getLogger(__name__)

# Verdict reasons are LLM-generated free text; cap what we persist per row.
REASON_MAX_CHARS = 2048


def _get_serialized_event(group: Group) -> tuple[str, dict[str, Any]] | None:
    event = group.get_recommended_event_for_environments()
    if not event:
        event = group.get_latest_event()
    if not event:
        return None

    ready_event = eventstore.get_event_by_id(group.project_id, event.event_id, group_id=group.id)
    if not ready_event:
        return None

    serialized_event = serialize(ready_event, None, EventSerializer())
    if serialized_event is None:
        return None

    event_data = dict(serialized_event)
    event_data.pop("_meta", None)
    return event.event_id, event_data


def _capture_autofix_issue_data(
    *,
    organization: Organization,
    verdicts: list[TriageVerdict],
    groups_by_id: Mapping[int, Group],
    log_extra: Mapping[str, object],
) -> dict[int, str]:
    event_ids: dict[int, str] = {}
    rows: list[SeerAutofixIssueData] = []
    for verdict in verdicts:
        group = groups_by_id[verdict.group_id]
        try:
            event_data = _get_serialized_event(group)
            if event_data is None:
                logger.warning(
                    "night_shift.autofix_issue_data.event_not_found",
                    extra={**log_extra, "group_id": group.id},
                )
                continue
            event_id, serialized_event = event_data
            raw_issue_data: dict[str, Any] = {
                "status": verdict.action.value,
                "reason": verdict.reason[:REASON_MAX_CHARS] if verdict.reason else None,
                "event_id": event_id,
                "event": serialized_event,
                "issue": {
                    "title": group.title,
                    "culprit": group.culprit,
                    "platform": group.platform,
                    "type": group.type,
                    "message": group.message,
                    "first_seen": group.first_seen,
                    "last_seen": group.last_seen,
                    "times_seen": group.times_seen,
                    "logger": group.logger,
                    "data": group.data,
                },
            }
            rows.append(
                SeerAutofixIssueData(
                    group=group,
                    organization_id=organization.id,
                    project_id=group.project_id,
                    source="night_shift",
                    raw_issue_data=json.loads(json.dumps(raw_issue_data)),
                )
            )
            event_ids[group.id] = event_id
        except Exception:
            logger.exception(
                "night_shift.autofix_issue_data.capture_failed",
                extra={**log_extra, "group_id": group.id},
            )

    SeerAutofixIssueData.objects.bulk_create(
        rows,
        update_conflicts=True,
        unique_fields=["group"],
        update_fields=["organization", "project", "source", "raw_issue_data", "date_updated"],
    )
    return event_ids


def deliver_agentic_triage_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    """Process an agentic triage result from Seer."""
    shard = (
        SeerWorkflowRunExecution.objects.filter(
            seer_run__uuid=run_uuid, run__organization_id=organization_id
        )
        .select_related("run", "run__organization", "seer_run")
        .first()
    )
    if shard is None:
        logger.warning(
            "night_shift.delivery.missing_run",
            extra={"organization_id": organization_id, "run_uuid": run_uuid},
        )
        return
    run = shard.run
    # Guaranteed by the seer_run__uuid filter above: a null FK can't match a uuid.
    assert shard.seer_run is not None

    # Per-delivery metadata lives on the shard so a sibling shard's success
    # can't clear it. prompt_version is written even on error deliveries,
    # which have no result rows to carry it.
    if prompt_version or error:
        extras = {**(shard.extras or {})}
        if prompt_version:
            extras["prompt_version"] = prompt_version
        if error:
            extras["error_type"] = SeerAgenticTriageRunErrorType.SHARD_DELIVERY_FAILED.value
            extras["error_message"] = error
        shard.update(extras=extras)

    log_extra: dict[str, object] = {
        "organization_id": run.organization_id,
        "run_id": shard.seer_run.seer_run_state_id,
        "sentry_run_id": run_uuid,
        "night_shift_run_id": run.id,
    }

    if status == "error" or result is None:
        sentry_sdk.metrics.count(
            "night_shift.triage_error",
            1,
            attributes={"error_type": "delivery_error" if status == "error" else "no_artifact"},
        )
        logger.warning("night_shift.delivery.no_result", extra={**log_extra, "status": status})
        return

    try:
        triage_response = TriageResponse.parse_obj(result)
    except Exception:
        sentry_sdk.metrics.count(
            "night_shift.triage_error", 1, attributes={"error_type": "invalid_artifact"}
        )
        logger.exception("night_shift.delivery.invalid_result", extra=log_extra)
        return

    options = (run.extras or {}).get("options") or {}
    dry_run = bool(options.get("dry_run", False))

    # Clear any stale delivery error now that this delivery has succeeded.
    if (shard.extras or {}).get("error_message"):
        extras = {**shard.extras}
        del extras["error_message"]
        extras.pop("error_type", None)
        shard.update(extras=extras)

    _process_verdicts(
        run=run,
        organization=run.organization,
        triage_response=triage_response,
        dry_run=dry_run,
        prompt_version=prompt_version,
        enable_code_mode_tools=shard.extras.get("enable_code_mode_tools"),
        log_extra=log_extra,
    )


def _process_verdicts(
    *,
    run: SeerWorkflowRun,
    organization: Organization,
    triage_response: TriageResponse,
    dry_run: bool,
    prompt_version: str | None,
    enable_code_mode_tools: str | None,
    log_extra: Mapping[str, object],
) -> None:
    """Mark SKIPs, fire autofix for fixable verdicts, and persist one result row
    per verdict (every action, dry runs included) for later analysis."""
    group_ids = [v.group_id for v in triage_response.verdicts]
    groups_by_id: dict[int, Group] = {
        g.id: g
        for g in Group.objects.filter(
            id__in=group_ids,
            project__organization_id=organization.id,
            project__status=ObjectStatus.ACTIVE,
        ).select_related("project")
    }

    unknown_group_ids = [gid for gid in group_ids if gid not in groups_by_id]
    if unknown_group_ids:
        logger.warning(
            "night_shift.delivery.unknown_group_ids",
            extra={**log_extra, "unknown_group_ids": unknown_group_ids},
        )

    # Groups this run already has a result row for (e.g. Seer redelivered a
    # shard result): don't re-trigger autofix or write duplicate rows for them.
    # Matched on group_id, not idempotency_key, so rows written before
    # idempotency_key existed (and are still null) are recognized too.
    recorded_group_ids = set(
        SeerAgenticTriageRunResult.objects.filter(
            run=run,
            kind=SeerWorkflowStrategy.AGENTIC_TRIAGE,
            group_id__in=group_ids,
        ).values_list("group_id", flat=True)
    )

    # SKIP and ROOT_CAUSE_ONLY are both suppressed from future runs via the skip
    # cache. ROOT_CAUSE_ONLY keeps its own action value for tracking, but is
    # otherwise treated identically to SKIP (it does not trigger autofix).
    verdicts: list[TriageVerdict] = []
    fixable_groups: list[Group] = []
    for v in triage_response.verdicts:
        group = groups_by_id.get(v.group_id)
        if group is None or v.group_id in recorded_group_ids:
            continue
        verdicts.append(v)
        if v.action in (TriageAction.SKIP, TriageAction.ROOT_CAUSE_ONLY):
            mark_skipped(v.group_id)
            if v.action == TriageAction.SKIP:
                sentry_sdk.metrics.count(
                    "night_shift.skip_reason",
                    1,
                    attributes={"skip_reason": v.skip_reason or "unknown"},
                )
        elif v.action == TriageAction.AUTOFIX:
            fixable_groups.append(group)

    sentry_sdk.metrics.distribution("night_shift.candidates_selected", len(fixable_groups))
    if not fixable_groups:
        logger.info(
            "night_shift.no_fixable_candidates",
            extra={**log_extra, "num_candidates": len(verdicts)},
        )

    reason_by_group_id = {v.group_id: v.reason for v in verdicts}
    run_by_group: dict[int, SeerRun] = {}
    rate_limited_group_ids: set[int] = set()
    if not dry_run and fixable_groups:
        # Cache organization on each group's project to avoid N+1 queries
        for group in groups_by_id.values():
            group.project.organization = organization

        # Build stopping_point_by_project_id from project preferences (bulk query)
        project_ids = {group.project_id for group in fixable_groups}
        preferences = bulk_read_preferences_from_sentry_db(organization.id, list(project_ids))
        default_stopping_point = AutofixStoppingPoint(SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT)
        stopping_point_by_project_id = {
            pid: AutofixStoppingPoint(
                pref.automated_run_stopping_point or SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
            )
            if (pref := preferences.get(pid)) is not None
            else default_stopping_point
            for pid in project_ids
        }

        referrer = referrer_map[SeerAutomationSource.AGENTIC_TRIAGE]

        # Rate limit only applies to legacy org plans
        check_rate_limit = not is_seer_seat_based_tier_enabled(organization)

        for group in fixable_groups:
            if check_rate_limit and is_seer_autotriggered_autofix_rate_limited_and_increment(
                group.project, organization
            ):
                rate_limited_group_ids.add(group.id)
                continue

            reason = reason_by_group_id[group.id]
            user_context = (
                f"Agentic triage already investigated this issue and concluded:\n{reason}"
                if reason
                else None
            )
            try:
                triggered_run = trigger_autofix_agent(
                    group=group,
                    step=AutofixStep.ROOT_CAUSE,
                    referrer=referrer,
                    stopping_point=stopping_point_by_project_id[group.project_id],
                    user_context=user_context,
                    allow_free_cohort=True,
                )
            except Exception:
                logger.exception(
                    "night_shift.autofix_trigger_failed",
                    extra={**log_extra, "group_id": group.id},
                )
                continue

            run_by_group[group.id] = triggered_run
            with action_context_scope(ActionSource.SYSTEM, SYSTEM_ACTOR):
                Activity.objects.create_group_activity(
                    group,
                    ActivityType.TRIGGER_AUTOFIX,
                    data={"referrer": referrer.value},
                    send_notification=False,
                )

        sentry_sdk.metrics.count("night_shift.autofix_triggered", len(run_by_group))
        if rate_limited_group_ids:
            sentry_sdk.metrics.count(
                "night_shift.autofix_rate_limited", len(rate_limited_group_ids)
            )
            logger.info(
                "night_shift.autofix_rate_limited",
                extra={**log_extra, "num_rate_limited": len(rate_limited_group_ids)},
            )

    rows: list[SeerAgenticTriageRunResult] = []
    for v in verdicts:
        extras: dict[str, Any] = {"action": str(v.action)}
        # Denormalized so analysis by mode and prompt version needs no shard join.
        if prompt_version:
            extras["prompt_version"] = prompt_version
        if enable_code_mode_tools is not None:
            extras["enable_code_mode_tools"] = enable_code_mode_tools
        if v.reason:
            extras["reason"] = v.reason[:REASON_MAX_CHARS]
        if v.action == TriageAction.SKIP and v.skip_reason:
            extras["skip_reason"] = v.skip_reason
        seer_run_id: str | None = None
        result_seer_run: SeerRun | None = None
        if v.action == TriageAction.AUTOFIX and not dry_run:
            result_seer_run = run_by_group.get(v.group_id)
            if result_seer_run is None:
                if v.group_id in rate_limited_group_ids:
                    extras["rate_limited"] = True
                else:
                    extras["trigger_error"] = True
            else:
                seer_run_id = str(result_seer_run.seer_run_state_id)
        rows.append(
            SeerAgenticTriageRunResult(
                run=run,
                kind=SeerWorkflowStrategy.AGENTIC_TRIAGE,
                group=groups_by_id[v.group_id],
                idempotency_key=str(v.group_id),
                seer_run_id=seer_run_id,
                result_seer_run=result_seer_run,
                extras=extras,
            )
        )
    # ignore_conflicts: concurrent redeliveries can race past the recorded-rows check.
    SeerAgenticTriageRunResult.objects.bulk_create(rows, ignore_conflicts=True)

    captured_event_ids: dict[int, str] = {}
    try:
        if features.has("organizations:seer-fixability-training-data", organization):
            captured_event_ids = _capture_autofix_issue_data(
                organization=organization,
                verdicts=verdicts,
                groups_by_id=groups_by_id,
                log_extra=log_extra,
            )
    except Exception:
        logger.exception("night_shift.autofix_issue_data.capture_failed", extra=log_extra)

    logger.info(
        "night_shift.candidates_selected",
        extra={
            **log_extra,
            "num_verdicts": len(triage_response.verdicts),
            "num_already_recorded": len(recorded_group_ids),
            "dry_run": dry_run,
            "candidates": [
                {
                    "group_id": v.group_id,
                    "action": v.action,
                    "event_id": captured_event_ids.get(v.group_id),
                    "seer_run_id": (
                        str(r.seer_run_state_id)
                        if (r := run_by_group.get(v.group_id)) is not None
                        else None
                    ),
                }
                for v in triage_response.verdicts
            ],
        },
    )

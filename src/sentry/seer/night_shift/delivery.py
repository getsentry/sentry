"""Delivery handler for night_shift feature results from Seer."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import sentry_sdk

from sentry.constants import SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT, ObjectStatus
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.autofix.autofix_agent import AutofixStep, trigger_autofix_agent
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.issue_summary import referrer_map
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    bulk_read_preferences_from_sentry_db,
    is_seer_autotriggered_autofix_rate_limited_and_increment,
    is_seer_seat_based_tier_enabled,
)
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunResult,
    SeerNightShiftRunShard,
)
from sentry.seer.models.run import SeerRun
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.night_shift.models import TriageResponse, TriageVerdict
from sentry.tasks.seer.night_shift.models import TriageAction
from sentry.tasks.seer.night_shift.skip_cache import mark_skipped

logger = logging.getLogger(__name__)

# Verdict reasons are LLM-generated free text; cap what we persist per row.
REASON_MAX_CHARS = 2048


def deliver_night_shift_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    """Process a night_shift result from Seer."""
    shard = (
        SeerNightShiftRunShard.objects.filter(
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

    # Per-delivery error_message lives on the shard so a sibling shard's success
    # can't clear it.
    if error:
        shard.update(extras={**(shard.extras or {}), "error_message": error})

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

    # Clear any stale error_message now that this delivery has succeeded.
    if (shard.extras or {}).get("error_message"):
        extras = {**shard.extras}
        del extras["error_message"]
        shard.update(extras=extras)

    _process_verdicts(
        run=run,
        organization=run.organization,
        triage_response=triage_response,
        dry_run=dry_run,
        log_extra=log_extra,
    )


def _process_verdicts(
    *,
    run: SeerNightShiftRun,
    organization: Organization,
    triage_response: TriageResponse,
    dry_run: bool,
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
        SeerNightShiftRunResult.objects.filter(
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
    state_id_by_group: dict[int, int] = {}
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

        referrer = referrer_map[SeerAutomationSource.NIGHT_SHIFT]

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
                f"Night-shift triage already investigated this issue and concluded:\n{reason}"
                if reason
                else None
            )
            try:
                state_id_by_group[group.id] = trigger_autofix_agent(
                    group=group,
                    step=AutofixStep.ROOT_CAUSE,
                    referrer=referrer,
                    stopping_point=stopping_point_by_project_id[group.project_id],
                    user_context=user_context,
                )
            except Exception:
                logger.exception(
                    "night_shift.autofix_trigger_failed",
                    extra={**log_extra, "group_id": group.id},
                )

        sentry_sdk.metrics.count("night_shift.autofix_triggered", len(state_id_by_group))
        if rate_limited_group_ids:
            sentry_sdk.metrics.count(
                "night_shift.autofix_rate_limited", len(rate_limited_group_ids)
            )
            logger.info(
                "night_shift.autofix_rate_limited",
                extra={**log_extra, "num_rate_limited": len(rate_limited_group_ids)},
            )

    # TODO: have trigger_autofix_agent return the SeerRun directly to avoid this lookup.
    seer_run_by_state_id = {
        sr.seer_run_state_id: sr
        for sr in SeerRun.objects.filter(seer_run_state_id__in=state_id_by_group.values())
    }

    rows: list[SeerNightShiftRunResult] = []
    for v in verdicts:
        extras: dict[str, Any] = {"action": str(v.action)}
        if v.reason:
            extras["reason"] = v.reason[:REASON_MAX_CHARS]
        if v.action == TriageAction.SKIP and v.skip_reason:
            extras["skip_reason"] = v.skip_reason
        seer_run_id: str | None = None
        result_seer_run: SeerRun | None = None
        if v.action == TriageAction.AUTOFIX and not dry_run:
            state_id = state_id_by_group.get(v.group_id)
            if state_id is None:
                if v.group_id in rate_limited_group_ids:
                    extras["rate_limited"] = True
                else:
                    extras["trigger_error"] = True
            else:
                seer_run_id = str(state_id)
                result_seer_run = seer_run_by_state_id.get(state_id)
        rows.append(
            SeerNightShiftRunResult(
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
    SeerNightShiftRunResult.objects.bulk_create(rows, ignore_conflicts=True)

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
                    "seer_run_id": (
                        str(state_id)
                        if (state_id := state_id_by_group.get(v.group_id)) is not None
                        else None
                    ),
                }
                for v in triage_response.verdicts
            ],
        },
    )

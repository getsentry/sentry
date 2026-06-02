"""Delivery handler for night_shift feature results from Seer."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk

from sentry.constants import SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.feature_delivery import FeatureRunStatus
from sentry.seer.autofix.autofix_agent import AutofixStep, trigger_autofix_agent
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.seer.autofix.issue_summary import referrer_map
from sentry.seer.autofix.utils import AutofixStoppingPoint, read_preference_from_sentry_db
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunResult
from sentry.seer.models.run import SeerRun
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.night_shift.models import TriageResponse, TriageVerdict
from sentry.tasks.seer.night_shift.models import TriageAction
from sentry.tasks.seer.night_shift.skip_cache import mark_skipped

logger = logging.getLogger(__name__)


def deliver_night_shift_result(
    ref: int | str,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    seer_run_id: int,
    error: str | None,
    organization_id: int,
) -> None:
    """Process a night_shift result from Seer."""
    try:
        run = SeerNightShiftRun.objects.select_related("organization", "seer_run").get(
            seer_run__uuid=ref
        )
    except SeerNightShiftRun.DoesNotExist:
        logger.warning(
            "night_shift.delivery.missing_run",
            extra={"ref": ref, "seer_run_id": seer_run_id},
        )
        return

    if run.organization_id != organization_id:
        logger.warning(
            "night_shift.delivery.org_mismatch",
            extra={
                "ref": ref,
                "expected_org_id": run.organization_id,
                "actual_org_id": organization_id,
            },
        )
        return

    extras_update: dict[str, object] = {
        **(run.extras or {}),
        "agent_run_id": seer_run_id,
    }
    if error:
        extras_update["error_message"] = error
    run.update(extras=extras_update)

    log_extra: dict[str, object] = {
        "organization_id": run.organization_id,
        "run_id": run.id,
        "agent_run_id": seer_run_id,
    }

    if status == "error" or result is None:
        sentry_sdk.metrics.incr(
            "night_shift.triage_error",
            tags={"error_type": "delivery_error" if status == "error" else "no_artifact"},
        )
        logger.warning("night_shift.delivery.no_result", extra={**log_extra, "status": status})
        return

    try:
        triage_response = TriageResponse.parse_obj(result)
    except Exception:
        sentry_sdk.metrics.incr("night_shift.triage_error", tags={"error_type": "invalid_artifact"})
        logger.exception("night_shift.delivery.invalid_result", extra=log_extra)
        return

    options = (run.extras or {}).get("options") or {}
    dry_run = bool(options.get("dry_run", False))

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
    """Mark SKIPs, fire autofix for fixable verdicts, persist result rows."""
    group_ids = [v.group_id for v in triage_response.verdicts]
    groups_by_id: dict[int, Group] = {
        g.id: g
        for g in Group.objects.filter(
            id__in=group_ids, project__organization_id=organization.id
        ).select_related("project")
    }

    unknown_group_ids = [gid for gid in group_ids if gid not in groups_by_id]
    if unknown_group_ids:
        logger.warning(
            "night_shift.delivery.unknown_group_ids",
            extra={**log_extra, "unknown_group_ids": unknown_group_ids},
        )

    for v in triage_response.verdicts:
        if v.action == TriageAction.SKIP and v.group_id in groups_by_id:
            mark_skipped(v.group_id)

    fixable_verdicts = [
        v
        for v in triage_response.verdicts
        if v.action in (TriageAction.AUTOFIX, TriageAction.ROOT_CAUSE_ONLY)
        and v.group_id in groups_by_id
    ]

    sentry_sdk.metrics.distribution(
        "night_shift.candidates_selected", len(triage_response.verdicts)
    )

    results: list[SeerNightShiftRunResult] = []
    if not dry_run:
        results = _trigger_autofix_for_fixable(
            run=run,
            organization=organization,
            verdicts=fixable_verdicts,
            groups_by_id=groups_by_id,
            log_extra=log_extra,
        )

    seer_run_id_by_group = {r.group_id: r.seer_run_id for r in results}
    logger.info(
        "night_shift.candidates_selected",
        extra={
            **log_extra,
            "num_verdicts": len(triage_response.verdicts),
            "dry_run": dry_run,
            "candidates": [
                {
                    "group_id": v.group_id,
                    "action": v.action,
                    "seer_run_id": seer_run_id_by_group.get(v.group_id),
                }
                for v in triage_response.verdicts
            ],
        },
    )


def _trigger_autofix_for_fixable(
    *,
    run: SeerNightShiftRun,
    organization: Organization,
    verdicts: list[TriageVerdict],
    groups_by_id: dict[int, Group],
    log_extra: Mapping[str, object],
) -> list[SeerNightShiftRunResult]:
    if not verdicts:
        return []

    referrer = referrer_map[SeerAutomationSource.NIGHT_SHIFT]
    project_ids = {groups_by_id[v.group_id].project_id for v in verdicts}
    project_by_id = {g.project_id: g.project for g in groups_by_id.values()}

    for project in project_by_id.values():
        project.organization = organization

    stopping_point_by_project_id = {
        pid: AutofixStoppingPoint(
            read_preference_from_sentry_db(project_by_id[pid]).automated_run_stopping_point
            or SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
        )
        for pid in project_ids
    }

    results: list[SeerNightShiftRunResult] = []
    for v in verdicts:
        group = groups_by_id[v.group_id]
        stopping_point = (
            AutofixStoppingPoint.ROOT_CAUSE
            if v.action == TriageAction.ROOT_CAUSE_ONLY
            else stopping_point_by_project_id[group.project_id]
        )
        user_context = (
            f"Night-shift triage already investigated this issue and concluded:\n{v.reason}"
            if v.reason
            else None
        )
        try:
            seer_run_id = trigger_autofix_agent(
                group=group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=referrer,
                stopping_point=stopping_point,
                user_context=user_context,
            )
        except Exception:
            logger.exception(
                "night_shift.autofix_trigger_failed",
                extra={**log_extra, "group_id": group.id},
            )
            continue

        result_seer_run = SeerRun.objects.filter(seer_run_state_id=seer_run_id).first()
        results.append(
            SeerNightShiftRunResult(
                run=run,
                kind=SeerWorkflowStrategy.AGENTIC_TRIAGE,
                group=group,
                seer_run_id=str(seer_run_id),
                result_seer_run=result_seer_run,
            )
        )

    SeerNightShiftRunResult.objects.bulk_create(results)
    sentry_sdk.metrics.incr("night_shift.autofix_triggered", amount=len(results))
    return results

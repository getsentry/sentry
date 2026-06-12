"""Delivery handler for night_shift feature results from Seer."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk

from sentry.constants import SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT, ObjectStatus
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.autofix.utils import AutofixStoppingPoint, bulk_read_preferences_from_sentry_db
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunResult
from sentry.seer.night_shift.models import TriageResponse
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.tasks.seer.night_shift.skip_cache import mark_skipped

logger = logging.getLogger(__name__)


def deliver_night_shift_result(
    organization_id: int,
    run_uuid: str,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    """Process a night_shift result from Seer."""
    try:
        run = SeerNightShiftRun.objects.select_related("organization", "seer_run").get(
            organization_id=organization_id,
            seer_run__uuid=run_uuid,
        )
    except SeerNightShiftRun.DoesNotExist:
        logger.warning(
            "night_shift.delivery.missing_run",
            extra={"organization_id": organization_id, "run_uuid": run_uuid},
        )
        return

    if error:
        run.update(extras={**(run.extras or {}), "error_message": error})

    log_extra: dict[str, object] = {
        "organization_id": run.organization_id,
        "run_id": run.id,
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

    # A failed dispatch may have left a stale error_message even though Seer went
    # on to process the run and is now delivering verdicts. Clear it so the run's
    # state reflects the successful delivery.
    if (run.extras or {}).get("error_message"):
        extras = {**run.extras}
        del extras["error_message"]
        run.update(extras=extras)

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
    # Import here to avoid circular import
    from sentry.tasks.seer.night_shift.cron import _run_autofix_for_candidates

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

    # SKIP and ROOT_CAUSE_ONLY are both suppressed from future runs via the skip
    # cache. ROOT_CAUSE_ONLY keeps its own action value for tracking, but is
    # otherwise treated identically to SKIP (it does not trigger autofix).
    for v in triage_response.verdicts:
        if (
            v.action in (TriageAction.SKIP, TriageAction.ROOT_CAUSE_ONLY)
            and v.group_id in groups_by_id
        ):
            mark_skipped(v.group_id)

    # Convert verdicts to TriageResult objects for the shared function
    fixable_candidates = [
        TriageResult(group=groups_by_id[v.group_id], action=v.action, reason=v.reason)
        for v in triage_response.verdicts
        if v.action == TriageAction.AUTOFIX and v.group_id in groups_by_id
    ]

    sentry_sdk.metrics.distribution("night_shift.candidates_selected", len(fixable_candidates))

    results: list[SeerNightShiftRunResult] = []
    if not dry_run and fixable_candidates:
        # Cache organization on each group's project to avoid N+1 queries
        for group in groups_by_id.values():
            group.project.organization = organization

        # Build stopping_point_by_project_id from project preferences (bulk query)
        project_ids = {c.group.project_id for c in fixable_candidates}
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

        results = _run_autofix_for_candidates(
            run=run,
            candidates=fixable_candidates,
            stopping_point_by_project_id=stopping_point_by_project_id,
            log_extra=dict(log_extra),
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

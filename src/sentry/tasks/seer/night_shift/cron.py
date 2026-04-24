from __future__ import annotations

import logging
import time
from collections import Counter
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

import sentry_sdk

from sentry import features, options, quotas
from sentry.constants import DataCategory, ObjectStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.seer.autofix.autofix_agent import AutofixStep, trigger_autofix_explorer
from sentry.seer.autofix.constants import (
    AutofixAutomationTuningSettings,
    SeerAutomationSource,
)
from sentry.seer.autofix.issue_summary import referrer_map
from sentry.seer.autofix.utils import AutofixStoppingPoint, bulk_read_preferences_from_sentry_db
from sentry.seer.models.night_shift import SeerNightShiftRun, SeerNightShiftRunIssue
from sentry.seer.models.seer_api_models import SeerProjectPreference
from sentry.tasks.base import instrumented_task
from sentry.tasks.seer.night_shift.agentic_triage import agentic_triage_strategy
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_DISPATCH_STEP_SECONDS = 37
NIGHT_SHIFT_SPREAD_DURATION = timedelta(hours=4)

FEATURE_NAMES = [
    "organizations:seer-night-shift",
    "organizations:gen-ai-features",
    "organizations:seat-based-seer-enabled",
]


@instrumented_task(
    name="sentry.tasks.seer.night_shift.schedule_night_shift",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,
)
def schedule_night_shift(**kwargs: Any) -> None:
    """
    Nightly scheduler: iterates active orgs in batches, checks feature flags
    in bulk, and dispatches per-org worker tasks with jitter.
    """
    if not options.get("seer.night_shift.enable"):
        return

    spread_seconds = int(NIGHT_SHIFT_SPREAD_DURATION.total_seconds())
    batch_index = 0

    for org_batch in chunked(
        RangeQuerySetWrapper[Organization](
            Organization.objects.filter(status=OrganizationStatus.ACTIVE),
            step=1000,
        ),
        100,
    ):
        for org in _get_eligible_orgs_from_batch(org_batch):
            delay = (batch_index * NIGHT_SHIFT_DISPATCH_STEP_SECONDS) % spread_seconds

            run_night_shift_for_org.apply_async(
                args=[org.id],
                countdown=delay,
            )
            batch_index += 1

    sentry_sdk.metrics.count("night_shift.orgs_dispatched", batch_index)

    logger.info(
        "night_shift.schedule_complete",
        extra={"orgs_dispatched": batch_index},
    )


@instrumented_task(
    name="sentry.tasks.seer.night_shift.run_night_shift_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_night_shift_for_org(
    organization_id: int,
    dry_run: bool = False,
    max_candidates: int | None = None,
    **kwargs: Any,
) -> int | None:
    organization = Organization.objects.filter(
        id=organization_id, status=OrganizationStatus.ACTIVE
    ).first()
    if organization is None:
        return None

    log_extra: dict[str, object] = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
    }
    sentry_sdk.set_tags(
        {"organization_id": organization.id, "organization_slug": organization.slug}
    )

    return _execute_night_shift_run(
        organization,
        dry_run=dry_run,
        max_candidates=max_candidates,
        log_extra=log_extra,
    )


@instrumented_task(
    name="sentry.tasks.seer.night_shift.run_night_shift_for_project",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_night_shift_for_project(
    project_id: int,
    dry_run: bool = False,
    max_candidates: int | None = None,
    **kwargs: Any,
) -> int | None:
    """One-off night shift run scoped to a single project, e.g. from the
    project settings "Run Now" button."""
    project = (
        Project.objects.filter(id=project_id, status=ObjectStatus.ACTIVE)
        .select_related("organization")
        .first()
    )
    if project is None:
        return None

    organization = project.organization
    if organization.status != OrganizationStatus.ACTIVE:
        return None

    log_extra: dict[str, object] = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "project_id": project.id,
        "project_slug": project.slug,
    }
    sentry_sdk.set_tags(
        {
            "organization_id": organization.id,
            "organization_slug": organization.slug,
            "project_id": project.id,
        }
    )

    return _execute_night_shift_run(
        organization,
        project_id=project.id,
        dry_run=dry_run,
        max_candidates=max_candidates,
        log_extra=log_extra,
    )


def _execute_night_shift_run(
    organization: Organization,
    *,
    project_id: int | None = None,
    dry_run: bool,
    max_candidates: int | None,
    log_extra: dict[str, object],
) -> int | None:
    """Create a SeerNightShiftRun, run triage against eligible projects, and
    optionally dispatch autofix. Shared between the org-wide scheduler and
    per-project manual triggers."""
    start_time = time.monotonic()

    run = SeerNightShiftRun.objects.create(
        organization=organization,
        triage_strategy="agentic_triage",
    )
    log_extra["run_id"] = run.id

    if not quotas.backend.check_seer_quota(
        org_id=organization.id,
        data_category=DataCategory.SEER_AUTOFIX,
    ):
        logger.info("night_shift.no_seer_quota", extra=log_extra)
        run.update(error_message="No Seer quota available")
        return None

    try:
        eligible_projects, _ = _get_eligible_projects(organization, project_id=project_id)
    except Exception:
        _fail_run(
            run,
            message="Failed to get eligible projects",
            event="night_shift.failed_to_get_eligible_projects",
            extra=log_extra,
        )
        return None

    sentry_sdk.metrics.distribution("night_shift.eligible_projects", len(eligible_projects))

    if not eligible_projects:
        logger.info("night_shift.no_eligible_projects", extra=log_extra)
        return None

    resolved_max_candidates = (
        max_candidates
        if max_candidates is not None
        else options.get("seer.night_shift.issues_per_org")
    )

    agent_run_id = None
    try:
        candidates, agent_run_id = agentic_triage_strategy(
            eligible_projects, organization, resolved_max_candidates
        )
        if agent_run_id is not None:
            run.update(extras={**run.extras, "agent_run_id": agent_run_id})
            log_extra["agent_run_id"] = agent_run_id
    except Exception:
        sentry_sdk.metrics.count("night_shift.run_error", 1)
        _fail_run(
            run,
            message="Night shift run failed",
            event="night_shift.run_failed",
            extra={**log_extra, "agent_run_id": agent_run_id},
        )
        return None

    sentry_sdk.metrics.distribution("night_shift.candidates_selected", len(candidates))
    action_counts = Counter(c.action for c in candidates)
    for action, count in action_counts.items():
        sentry_sdk.metrics.count("night_shift.triage_action", count, attributes={"action": action})
    sentry_sdk.metrics.distribution("night_shift.org_run_duration", time.monotonic() - start_time)

    seer_run_id_by_group: dict[int, str | None] = {}
    if not dry_run:
        # Populate each candidate group's FK cache so trigger_autofix_explorer doesn't
        # re-fetch group.project on every call. Group.organization is a property that
        # delegates to self.project.organization, so caching the org on the project is
        # enough to avoid both lookups.
        projects_by_id = {}
        for p in eligible_projects:
            p.organization = organization
            projects_by_id[p.id] = p
        for c in candidates:
            c.group.project = projects_by_id[c.group.project_id]

        issues = _run_autofix_for_candidates(
            run=run,
            candidates=candidates,
            log_extra=log_extra,
        )
        seer_run_id_by_group = {i.group_id: i.seer_run_id for i in issues}

    logger.info(
        "night_shift.candidates_selected",
        extra={
            **log_extra,
            "num_eligible_projects": len(eligible_projects),
            "num_candidates": len(candidates),
            "dry_run": dry_run,
            "candidates": [
                {
                    "group_id": c.group.id,
                    "action": c.action,
                    "seer_run_id": seer_run_id_by_group.get(c.group.id),
                }
                for c in candidates
            ],
        },
    )

    return agent_run_id


def _get_eligible_orgs_from_batch(
    orgs: Sequence[Organization],
) -> list[Organization]:
    """
    Check feature flags for a batch of orgs using batch_has_for_organizations.
    Returns orgs that have all required feature flags enabled.
    """
    eligible = [org for org in orgs if not org.get_option("sentry:hide_ai_features")]

    for feature_name in FEATURE_NAMES:
        batch_result = features.batch_has_for_organizations(feature_name, eligible)
        if batch_result is None:
            raise RuntimeError(f"batch_has_for_organizations returned None for {feature_name}")

        eligible = [org for org in eligible if batch_result.get(f"organization:{org.id}", False)]

        if not eligible:
            return []

    return eligible


def _fail_run(
    run: SeerNightShiftRun,
    *,
    message: str,
    event: str,
    extra: dict[str, object],
) -> None:
    """Log an exception and mark the run with an error message."""
    logger.exception(event, extra=extra)
    run.update(error_message=message)


def _get_eligible_projects(
    organization: Organization,
    project_id: int | None = None,
) -> tuple[list[Project], dict[int, SeerProjectPreference]]:
    """Return active projects that have automation enabled and connected repos.

    When project_id is provided, only that project is considered (for manual
    per-project triggers)."""
    project_qs = Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
    if project_id is not None:
        project_qs = project_qs.filter(id=project_id)
    project_map = {p.id: p for p in project_qs}
    if not project_map:
        return [], {}

    preferences = bulk_read_preferences_from_sentry_db(organization.id, list(project_map))

    candidates = [
        project_map[pid]
        for pid, pref in preferences.items()
        if pref.repositories
        and pref.autofix_automation_tuning != AutofixAutomationTuningSettings.OFF
    ]
    if not candidates:
        return [], preferences

    flag_result = features.batch_has(["projects:seer-night-shift"], projects=candidates)
    projects = [
        p
        for p in candidates
        if (flag_result or {}).get(f"project:{p.id}", {}).get("projects:seer-night-shift", False)
    ]
    return projects, preferences


def _run_autofix_for_candidates(
    run: SeerNightShiftRun,
    candidates: Sequence[TriageResult],
    log_extra: dict[str, object],
) -> list[SeerNightShiftRunIssue]:
    """
    For each fixable triage candidate, trigger a Seer autofix run and persist the
    resulting run id onto a newly created SeerNightShiftRunIssue row. Returns the
    list of rows that were created.
    """
    fixable_candidates = [
        c for c in candidates if c.action in (TriageAction.AUTOFIX, TriageAction.ROOT_CAUSE_ONLY)
    ]
    if not fixable_candidates:
        logger.info(
            "night_shift.no_fixable_candidates",
            extra={**log_extra, "num_candidates": len(candidates)},
        )
        return []

    referrer = referrer_map[SeerAutomationSource.NIGHT_SHIFT]

    issues = []
    for c in fixable_candidates:
        # Ignore automated_run_stopping_point preference — its default blocks PR creation.
        stopping_point = (
            AutofixStoppingPoint.ROOT_CAUSE
            if c.action == TriageAction.ROOT_CAUSE_ONLY
            else AutofixStoppingPoint.OPEN_PR
        )

        try:
            seer_run_id = trigger_autofix_explorer(
                group=c.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=referrer,
                stopping_point=stopping_point,
            )
        except Exception:
            logger.exception(
                "night_shift.autofix_trigger_failed",
                extra={**log_extra, "group_id": c.group.id},
            )
            continue

        issues.append(
            SeerNightShiftRunIssue(
                run=run,
                group=c.group,
                action=c.action,
                seer_run_id=str(seer_run_id),
            )
        )

    SeerNightShiftRunIssue.objects.bulk_create(issues)

    sentry_sdk.metrics.count("night_shift.autofix_triggered", len(issues))

    return issues

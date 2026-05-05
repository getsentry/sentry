from __future__ import annotations

import dataclasses
import logging
import time
from collections.abc import Mapping, Sequence
from datetime import timedelta
from typing import Any, Literal, TypedDict

import sentry_sdk
from django.db import transaction

from sentry import features, options, quotas
from sentry.constants import (
    SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT,
    DataCategory,
    ObjectStatus,
)
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.seer.autofix.autofix_agent import AutofixStep, trigger_autofix_agent
from sentry.seer.autofix.constants import (
    AutofixAutomationTuningSettings,
    SeerAutomationSource,
)
from sentry.seer.autofix.issue_summary import referrer_map
from sentry.seer.autofix.utils import AutofixStoppingPoint, bulk_read_preferences_from_sentry_db
from sentry.seer.models.night_shift import (
    NightShiftRunResultKind,
    SeerNightShiftRun,
    SeerNightShiftRunResult,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.base import instrumented_task
from sentry.tasks.seer.night_shift.agentic_triage import agentic_triage_strategy
from sentry.tasks.seer.night_shift.feedback_summary import agentic_feedback_summary_strategy
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.tasks.seer.night_shift.tweaks import (
    DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS,
    DEFAULT_INTELLIGENCE_LEVEL,
    DEFAULT_REASONING_EFFORT,
    IntelligenceLevel,
    NightShiftTweaks,
    ReasoningEffort,
    default_max_candidates,
    get_night_shift_tweaks,
)
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_DISPATCH_STEP_SECONDS = 37
NIGHT_SHIFT_SPREAD_DURATION = timedelta(hours=4)

NightShiftKind = Literal["agentic_triage", "feedback_summary"]
ALL_NIGHT_SHIFT_KINDS: tuple[NightShiftKind, ...] = ("agentic_triage", "feedback_summary")

# Each kind requires its own organization-level feature flag, so kinds can be
# rolled out independently.
KIND_FEATURE_NAMES: dict[NightShiftKind, str] = {
    "agentic_triage": "organizations:seer-night-shift",
    "feedback_summary": "organizations:seer-night-shift-feedback-summary",
}

# Universal flags required for any kind.
UNIVERSAL_BATCH_FEATURE_NAMES = [
    "organizations:gen-ai-features",
]
UNIVERSAL_PER_ORG_FEATURE_NAMES = [
    # INTERNAL handlers aren't routed through batch_has_for_organizations,
    # so this gets checked per-org on the survivors of the batch loop.
    "organizations:seat-based-seer-enabled",
]


NightShiftRunSource = Literal["cron", "manual"]


class SeerNightShiftRunOptions(TypedDict):
    """Fully-resolved options for a night shift run. Persisted directly onto
    SeerNightShiftRun.extras["options"]. Construct via build_run_options."""

    source: NightShiftRunSource
    max_candidates: int
    dry_run: bool
    intelligence_level: IntelligenceLevel
    reasoning_effort: ReasoningEffort
    extra_triage_instructions: str


class SeerNightShiftRunOptionsPartial(TypedDict, total=False):
    """Caller-facing options dict — every field is optional. Missing fields
    are filled in by build_run_options with shared defaults."""

    source: NightShiftRunSource
    max_candidates: int
    dry_run: bool
    intelligence_level: IntelligenceLevel
    reasoning_effort: ReasoningEffort
    extra_triage_instructions: str


@instrumented_task(
    name="sentry.tasks.seer.night_shift.schedule_night_shift",
    namespace=seer_tasks,
    processing_deadline_duration=30 * 60,
)
def schedule_night_shift(
    *,
    run_options: SeerNightShiftRunOptionsPartial | None = None,
    **kwargs: Any,
) -> None:
    """
    Nightly scheduler: collects org ids that have a Seer-connected repo, then
    dispatches per-org worker tasks in batches with jitter. Each org is
    dispatched once with the list of kinds its feature flags enable.
    """
    if not options.get("seer.night_shift.enable"):
        return

    logger.info("night_shift.schedule_start")
    start_time = time.monotonic()

    seer_org_ids: set[int] = set()
    for spr in RangeQuerySetWrapper[SeerProjectRepository](
        SeerProjectRepository.objects.filter(project__status=ObjectStatus.ACTIVE).select_related(
            "project"
        ),
        step=1000,
    ):
        seer_org_ids.add(spr.project.organization_id)

    logger.info(
        "night_shift.schedule_org_ids_collected",
        extra={
            "num_seer_org_ids": len(seer_org_ids),
            "elapsed_seconds": time.monotonic() - start_time,
        },
    )

    spread_seconds = int(NIGHT_SHIFT_SPREAD_DURATION.total_seconds())
    batch_index = 0
    base_kwargs: dict[str, Any] = {"options": dict(run_options)} if run_options else {}

    for chunk_index, org_id_chunk in enumerate(chunked(seer_org_ids, 100)):
        org_batch = list(
            Organization.objects.filter(
                id__in=list(org_id_chunk),
                status=OrganizationStatus.ACTIVE,
            )
        )
        kinds_by_org = _get_eligible_kinds_by_org(org_batch)
        for org, kinds in kinds_by_org.items():
            if not kinds:
                continue
            delay = (batch_index * NIGHT_SHIFT_DISPATCH_STEP_SECONDS) % spread_seconds
            task_kwargs = {**base_kwargs, "kinds": list(kinds)}
            run_night_shift_for_org.apply_async(args=[org.id], kwargs=task_kwargs, countdown=delay)
            batch_index += 1

        if chunk_index % 10 == 0:
            logger.info(
                "night_shift.schedule_chunk_processed",
                extra={
                    "chunk_index": chunk_index,
                    "orgs_dispatched_so_far": batch_index,
                    "elapsed_seconds": time.monotonic() - start_time,
                },
            )

    sentry_sdk.metrics.count("night_shift.orgs_dispatched", batch_index)

    logger.info(
        "night_shift.schedule_complete",
        extra={
            "orgs_dispatched": batch_index,
            "elapsed_seconds": time.monotonic() - start_time,
        },
    )


@instrumented_task(
    name="sentry.tasks.seer.night_shift.run_night_shift_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_night_shift_for_org(
    organization_id: int,
    *,
    kinds: Sequence[str] | None = None,
    options: SeerNightShiftRunOptionsPartial | None = None,
    project_ids: list[int] | None = None,
    triggering_user_id: int | None = None,
    execute_in_task: bool = False,
    **kwargs: Any,
) -> int | None:
    """Run night shift for one organization. `kinds` controls which units of
    work execute under this run; defaults to agentic_triage for backward
    compatibility with manual callers that haven't been updated."""
    organization = Organization.objects.filter(
        id=organization_id, status=OrganizationStatus.ACTIVE
    ).first()
    if organization is None:
        return None

    resolved_kinds = _validated_kinds(kinds)
    if not resolved_kinds:
        return None

    resolved_options = build_run_options(options)
    sentry_sdk.set_tags(
        {"organization_id": organization.id, "organization_slug": organization.slug}
    )

    extras: dict[str, object] = {
        "options": dict(resolved_options),
        "kinds": {k: {"status": "pending"} for k in resolved_kinds},
    }
    if project_ids is not None:
        extras["target_project_ids"] = project_ids
    if triggering_user_id is not None:
        extras["triggering_user_id"] = triggering_user_id

    run = SeerNightShiftRun.objects.create(
        organization=organization,
        extras=extras,
    )

    base_kwargs: dict[str, Any] = {"options": dict(resolved_options)}
    if project_ids is not None:
        base_kwargs["project_ids"] = project_ids

    for kind in resolved_kinds:
        per_kind_kwargs = {**base_kwargs, "kind": kind}
        if execute_in_task:
            run_night_shift_execution.apply_async(args=[run.id], kwargs=per_kind_kwargs)
        else:
            run_night_shift_execution(run.id, **per_kind_kwargs)
    return run.id


@instrumented_task(
    name="sentry.tasks.seer.night_shift.run_night_shift_execution",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_night_shift_execution(
    run_id: int,
    *,
    kind: str = "agentic_triage",
    options: SeerNightShiftRunOptionsPartial | None = None,
    project_ids: list[int] | None = None,
    **kwargs: Any,
) -> None:
    """Heavy phase of a night shift run for a single kind: quota check, then
    dispatch to the kind-specific strategy."""
    if kind not in ALL_NIGHT_SHIFT_KINDS:
        logger.error("night_shift.unknown_kind", extra={"run_id": run_id, "kind": kind})
        return None

    run = SeerNightShiftRun.objects.select_related("organization").filter(id=run_id).first()
    if run is None:
        logger.info("night_shift.missing_run", extra={"run_id": run_id})
        return None

    organization = run.organization
    resolved_options = _run_option_defaults(options or {})

    log_extra: dict[str, object] = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "run_id": run.id,
        "kind": kind,
    }
    if project_ids is not None:
        log_extra["project_ids"] = project_ids
    sentry_sdk.set_tags(
        {"organization_id": organization.id, "organization_slug": organization.slug}
    )

    start_time = time.monotonic()
    logger.info("night_shift.execute.start", extra=log_extra)

    _update_kind_state(run.id, kind, {"status": "running"})

    if not quotas.backend.check_seer_quota(
        org_id=organization.id,
        data_category=DataCategory.SEER_AUTOFIX,
    ):
        logger.info("night_shift.no_seer_quota", extra=log_extra)
        _update_kind_state(run.id, kind, {"status": "skipped", "reason": "no_seer_quota"})
        return None

    if kind == "agentic_triage":
        _execute_triage(
            run=run,
            organization=organization,
            resolved_options=resolved_options,
            project_ids=project_ids,
            log_extra=log_extra,
            start_time=start_time,
        )
    elif kind == "feedback_summary":
        _execute_feedback_summary(
            run=run,
            organization=organization,
            resolved_options=resolved_options,
            log_extra=log_extra,
        )


def _execute_triage(
    *,
    run: SeerNightShiftRun,
    organization: Organization,
    resolved_options: SeerNightShiftRunOptions,
    project_ids: list[int] | None,
    log_extra: dict[str, object],
    start_time: float,
) -> None:
    try:
        eligible = _get_eligible_projects(
            organization, resolved_options["source"], project_ids=project_ids
        )
    except Exception:
        _fail_kind(
            run,
            kind="agentic_triage",
            message="Failed to get eligible projects",
            event="night_shift.failed_to_get_eligible_projects",
            extra=log_extra,
        )
        return

    sentry_sdk.metrics.distribution("night_shift.eligible_projects", len(eligible))

    if not eligible:
        logger.info("night_shift.no_eligible_projects", extra=log_extra)
        _update_kind_state(
            run.id, "agentic_triage", {"status": "skipped", "reason": "no_eligible_projects"}
        )
        return

    eligible_projects = [ep.project for ep in eligible]
    agent_run_id: int | None = None
    try:
        candidates, agent_run_id = agentic_triage_strategy(
            eligible_projects,
            organization,
            resolved_options["max_candidates"],
            intelligence_level=resolved_options["intelligence_level"],
            reasoning_effort=resolved_options["reasoning_effort"],
            extra_triage_instructions=resolved_options["extra_triage_instructions"],
            run=run,
        )
        if agent_run_id is not None:
            log_extra["agent_run_id"] = agent_run_id
    except Exception:
        sentry_sdk.metrics.count("night_shift.run_error", 1)
        _fail_kind(
            run,
            kind="agentic_triage",
            message="Night shift run failed",
            event="night_shift.run_failed",
            extra={**log_extra, "agent_run_id": agent_run_id},
        )
        return

    sentry_sdk.metrics.distribution("night_shift.candidates_selected", len(candidates))
    sentry_sdk.metrics.distribution("night_shift.org_run_duration", time.monotonic() - start_time)

    seer_run_id_by_group: dict[int, str | None] = {}
    if not resolved_options["dry_run"]:
        # Populate each candidate group's FK cache so trigger_autofix_agent doesn't
        # re-fetch group.project on every call. Group.organization is a property that
        # delegates to self.project.organization, so caching the org on the project is
        # enough to avoid both lookups.
        projects_by_id = {}
        for p in eligible_projects:
            p.organization = organization
            projects_by_id[p.id] = p
        for c in candidates:
            c.group.project = projects_by_id[c.group.project_id]

        stopping_point_by_project_id = {ep.project.id: ep.stopping_point for ep in eligible}
        results = _run_autofix_for_candidates(
            run=run,
            candidates=candidates,
            options=resolved_options,
            stopping_point_by_project_id=stopping_point_by_project_id,
            log_extra=log_extra,
        )
        seer_run_id_by_group = {r.group_id: r.seer_run_id for r in results}

    _update_kind_state(
        run.id,
        "agentic_triage",
        {
            "status": "succeeded",
            "agent_run_id": agent_run_id,
            "num_candidates": len(candidates),
        },
    )

    logger.info(
        "night_shift.candidates_selected",
        extra={
            **log_extra,
            "num_eligible_projects": len(eligible_projects),
            "num_candidates": len(candidates),
            "dry_run": resolved_options["dry_run"],
            "candidates": [
                {
                    "group_id": c.group.id,
                    "action": c.action,
                    "seer_run_id": seer_run_id_by_group.get(c.group.id),
                    "num_occurrences": c.group.times_seen,
                }
                for c in candidates
            ],
        },
    )


def _execute_feedback_summary(
    *,
    run: SeerNightShiftRun,
    organization: Organization,
    resolved_options: SeerNightShiftRunOptions,
    log_extra: dict[str, object],
) -> None:
    agent_run_id: int | None = None
    try:
        agent_run_id = agentic_feedback_summary_strategy(
            organization,
            run=run,
            intelligence_level=resolved_options["intelligence_level"],
            reasoning_effort=resolved_options["reasoning_effort"],
        )
    except Exception:
        sentry_sdk.metrics.count("night_shift.feedback_summary_run_error", 1)
        _fail_kind(
            run,
            kind="feedback_summary",
            message="Feedback summary run failed",
            event="night_shift.feedback_summary.run_failed",
            extra={**log_extra, "agent_run_id": agent_run_id},
        )
        return

    if agent_run_id is None:
        # Strategy short-circuited (insufficient feedback).
        _update_kind_state(
            run.id,
            "feedback_summary",
            {"status": "skipped", "reason": "insufficient_feedbacks"},
        )
        return

    _update_kind_state(
        run.id,
        "feedback_summary",
        {"status": "succeeded", "agent_run_id": agent_run_id},
    )


def _run_option_defaults(data: Mapping[str, Any]) -> SeerNightShiftRunOptions:
    """Fill in defaults for any missing fields. Accepts any mapping so it can
    normalize both partial caller input and loosely-typed dicts read back from
    run.extras (which may predate later schema additions)."""
    max_candidates = data.get("max_candidates")
    return SeerNightShiftRunOptions(
        source=data.get("source", "cron"),
        max_candidates=default_max_candidates() if max_candidates is None else max_candidates,
        dry_run=data.get("dry_run", False),
        intelligence_level=data.get("intelligence_level", DEFAULT_INTELLIGENCE_LEVEL),
        reasoning_effort=data.get("reasoning_effort", DEFAULT_REASONING_EFFORT),
        extra_triage_instructions=data.get(
            "extra_triage_instructions", DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS
        ),
    )


def build_run_options(
    partial: SeerNightShiftRunOptionsPartial | None = None,
) -> SeerNightShiftRunOptions:
    """Resolve a partial options dict into a fully-populated one. Cron callers
    pass nothing (all defaults); manual callers pass at least `source="manual"`
    plus whichever tweaks they want to override."""
    return _run_option_defaults(partial or {})


def _validated_kinds(kinds: Sequence[str] | None) -> list[NightShiftKind]:
    if kinds is None:
        return ["agentic_triage"]
    deduped: list[NightShiftKind] = []
    seen: set[str] = set()
    for k in kinds:
        if k in seen:
            continue
        if k not in ALL_NIGHT_SHIFT_KINDS:
            logger.error("night_shift.unknown_kind_requested", extra={"kind": k})
            continue
        seen.add(k)
        deduped.append(k)
    return deduped


def _get_eligible_kinds_by_org(
    orgs: Sequence[Organization],
) -> dict[Organization, list[NightShiftKind]]:
    """Return org → list of kinds enabled for that org. Orgs that pass the
    universal gates but have no kinds enabled are present with an empty list."""
    universal_eligible = [org for org in orgs if not org.get_option("sentry:hide_ai_features")]

    for feature_name in UNIVERSAL_BATCH_FEATURE_NAMES:
        batch_result = features.batch_has_for_organizations(feature_name, universal_eligible)
        if batch_result is None:
            raise RuntimeError(f"batch_has_for_organizations returned None for {feature_name}")
        universal_eligible = [
            org for org in universal_eligible if batch_result.get(f"organization:{org.id}", False)
        ]
        if not universal_eligible:
            return {}

    for feature_name in UNIVERSAL_PER_ORG_FEATURE_NAMES:
        universal_eligible = [org for org in universal_eligible if features.has(feature_name, org)]
        if not universal_eligible:
            return {}

    kinds_by_org: dict[Organization, list[NightShiftKind]] = {org: [] for org in universal_eligible}
    for kind, feature_name in KIND_FEATURE_NAMES.items():
        batch_result = features.batch_has_for_organizations(feature_name, universal_eligible)
        if batch_result is None:
            raise RuntimeError(f"batch_has_for_organizations returned None for {feature_name}")
        for org in universal_eligible:
            if batch_result.get(f"organization:{org.id}", False):
                kinds_by_org[org].append(kind)

    return kinds_by_org


def _update_kind_state(run_id: int, kind: str, patch: Mapping[str, Any]) -> None:
    """Atomically merge `patch` into run.extras["kinds"][kind]. The kind
    branches run concurrently against the same parent row, so we use
    select_for_update to avoid clobbering each other's sub-dicts."""
    with transaction.atomic(using="default"):
        run = SeerNightShiftRun.objects.select_for_update().get(id=run_id)
        extras = dict(run.extras or {})
        kinds_state = dict(extras.get("kinds") or {})
        existing = dict(kinds_state.get(kind) or {})
        existing.update(patch)
        kinds_state[kind] = existing
        extras["kinds"] = kinds_state
        run.extras = extras
        run.save(update_fields=["extras"])


def _fail_kind(
    run: SeerNightShiftRun,
    *,
    kind: str,
    message: str,
    event: str,
    extra: dict[str, object],
) -> None:
    logger.exception(event, extra=extra)
    _update_kind_state(run.id, kind, {"status": "failed", "error_message": message})


@dataclasses.dataclass(frozen=True)
class EligibleProject:
    project: Project
    tweaks: NightShiftTweaks
    stopping_point: AutofixStoppingPoint


def _get_eligible_projects(
    organization: Organization,
    source: NightShiftRunSource,
    project_ids: list[int] | None = None,
) -> list[EligibleProject]:
    """Return active projects that have automation enabled and connected repos,
    each paired with its parsed night shift tweaks.

    When project_ids is provided, the org's projects are restricted to that set.
    Manual triggers bypass the tweaks.enabled gate — the user explicitly asked
    for this run. Scheduler runs respect it."""
    project_qs = Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
    if project_ids is not None:
        project_qs = project_qs.filter(id__in=project_ids)
    project_map = {p.id: p for p in project_qs}
    if not project_map:
        return []

    preferences = bulk_read_preferences_from_sentry_db(organization.id, list(project_map))

    with_automation = [
        project_map[pid]
        for pid, pref in preferences.items()
        if pref.repositories
        and pref.autofix_automation_tuning != AutofixAutomationTuningSettings.OFF
    ]
    if not with_automation:
        return []

    eligible = [
        EligibleProject(
            project=p,
            tweaks=get_night_shift_tweaks(p),
            stopping_point=AutofixStoppingPoint(
                preferences[p.id].automated_run_stopping_point
                or SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
            ),
        )
        for p in with_automation
    ]
    if source == "cron":
        eligible = [ep for ep in eligible if ep.tweaks.enabled]
    return eligible


def _run_autofix_for_candidates(
    run: SeerNightShiftRun,
    candidates: Sequence[TriageResult],
    options: SeerNightShiftRunOptions,
    stopping_point_by_project_id: Mapping[int, AutofixStoppingPoint],
    log_extra: dict[str, object],
) -> list[SeerNightShiftRunResult]:
    """
    For each fixable triage candidate, trigger a Seer autofix run and persist
    the resulting run id onto a newly created SeerNightShiftRunResult row.
    Returns the list of rows that were created.
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

    results: list[SeerNightShiftRunResult] = []
    for c in fixable_candidates:
        stopping_point = (
            AutofixStoppingPoint.ROOT_CAUSE
            if c.action == TriageAction.ROOT_CAUSE_ONLY
            else stopping_point_by_project_id[c.group.project_id]
        )

        user_context = (
            f"Night-shift triage already investigated this issue and concluded:\n{c.reason}"
            if c.reason
            else None
        )

        try:
            seer_run_id = trigger_autofix_agent(
                group=c.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=referrer,
                stopping_point=stopping_point,
                intelligence_level=options["intelligence_level"],
                reasoning_effort=options["reasoning_effort"],
                user_context=user_context,
            )
        except Exception:
            logger.exception(
                "night_shift.autofix_trigger_failed",
                extra={**log_extra, "group_id": c.group.id},
            )
            continue

        results.append(
            SeerNightShiftRunResult(
                run=run,
                kind=NightShiftRunResultKind.AGENTIC_TRIAGE,
                group=c.group,
                seer_run_id=str(seer_run_id),
                extras={"action": str(c.action)},
            )
        )

    SeerNightShiftRunResult.objects.bulk_create(results)

    sentry_sdk.metrics.count("night_shift.autofix_triggered", len(results))

    return results

from __future__ import annotations

import dataclasses
import logging
import time
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Literal, TypedDict

import sentry_sdk
from cronsim import CronSim
from django.conf import settings
from django.db import router, transaction
from django.utils import timezone
from django.utils.translation import ngettext
from taskbroker_client.scheduler.config import crontab

from sentry import features, options, quotas
from sentry.constants import (
    ENABLE_SEER_CODING_DEFAULT,
    HIDE_AI_FEATURES_DEFAULT,
    SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT,
    DataCategory,
    ObjectStatus,
)
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.autofix.constants import (
    AutofixAutomationTuningSettings,
)
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    bulk_read_preferences_from_sentry_db,
    is_free_cohort_org,
    is_seer_autotriggered_autofix_rate_limited,
    is_seer_seat_based_tier_enabled,
)
from sentry.seer.models import SeerPermissionError
from sentry.seer.models.night_shift import (
    SeerNightShiftRun,
    SeerNightShiftRunErrorType,
    SeerNightShiftRunShard,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.run import SeerRun
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.seer.night_shift.models import NightShiftPayload, TriageCandidate, TriageTweaks
from sentry.tasks.base import instrumented_task
from sentry.tasks.seer.night_shift.simple_triage import (
    fixability_score_strategy,
    fixability_score_strategy_per_project,
    priority_label,
)
from sentry.tasks.seer.night_shift.tweaks import (
    DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS,
    DEFAULT_INTELLIGENCE_LEVEL,
    DEFAULT_REASONING_EFFORT,
    IntelligenceLevel,
    NightShiftTweaks,
    ReasoningEffort,
    default_max_candidates,
    get_night_shift_org_tweaks,
    get_night_shift_tweaks,
)
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.hashlib import md5_text
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_SPREAD_DURATION = timedelta(hours=1)

BATCH_FEATURE_NAMES = [
    "organizations:seer-night-shift",
    "organizations:gen-ai-features",
]
PER_ORG_FEATURE_NAMES = [
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


@dataclasses.dataclass(frozen=True)
class NightShiftShardPlan:
    payload: dict[str, Any]
    title: str

    def to_extras(self) -> dict[str, object]:
        return {"payload": self.payload, "title": self.title}

    @classmethod
    def from_extras(cls, extras: Mapping[str, object]) -> NightShiftShardPlan | None:
        payload = extras.get("payload")
        title = extras.get("title")
        if not isinstance(payload, dict) or not isinstance(title, str):
            return None
        return cls(payload=payload, title=title)


class ShardDispatchStatus(StrEnum):
    COMPLETE = "complete"
    NO_SEER_ACCESS = "no_seer_access"
    INVALID_SHARD_PLAN = "invalid_shard_plan"
    PARTIAL_FAILURE = "partial_failure"


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
    dispatches per-org worker tasks in batches with jitter. Feature flags
    still gate the dispatch — SeerProjectRepository rows can outlive a paid
    Seer subscription.

    The real cron caller passes nothing (defaults). Manual admin triggers
    forward `run_options` so every per-org task inherits the same overrides
    (source="manual", dry_run, max_candidates, etc.).
    """
    if not options.get("seer.night_shift.enable"):
        return

    schedule_id: str | None = None
    if run_options is None:
        schedule_id = _current_schedule_id(datetime.now(tz=UTC), _night_shift_cron_expr())

    logger.info("night_shift.schedule_start", extra={"schedule_id": schedule_id})
    start_time = time.monotonic()

    seer_org_ids: set[int] = set()
    for spr in RangeQuerySetWrapper[SeerProjectRepository](
        SeerProjectRepository.objects.filter(
            project_repository__project__status=ObjectStatus.ACTIVE
        ).select_related("project_repository__project"),
        step=1000,
    ):
        seer_org_ids.add(spr.project_repository.project.organization_id)

    # Free cohort orgs may not have SeerProjectRepository rows — include them
    # so they reach the eligibility checks in _get_eligible_orgs_from_batch.
    try:
        free_cohort_org_ids = set(
            OrganizationOption.objects.filter(
                key="agentic-triage-free-cohort",
                value=True,
            ).values_list("organization_id", flat=True)
        )
        seer_org_ids |= free_cohort_org_ids
        if free_cohort_org_ids:
            logger.info(
                "night_shift.free_cohort_org_ids",
                extra={
                    "num_free_cohort_org_ids": len(free_cohort_org_ids),
                    "sample_org_ids": sorted(free_cohort_org_ids)[:10],
                },
            )
    except Exception:
        logger.exception("night_shift.free_cohort_org_ids_failed")

    logger.info(
        "night_shift.schedule_org_ids_collected",
        extra={
            "num_seer_org_ids": len(seer_org_ids),
            "elapsed_seconds": time.monotonic() - start_time,
        },
    )

    spread_seconds = int(NIGHT_SHIFT_SPREAD_DURATION.total_seconds())
    batch_index = 0
    task_kwargs: dict[str, Any] = {}
    if run_options is not None:
        task_kwargs["options"] = dict(run_options)
    if schedule_id is not None:
        task_kwargs["schedule_id"] = schedule_id

    for chunk_index, org_id_chunk in enumerate(chunked(seer_org_ids, 100)):
        org_batch = list(
            Organization.objects.filter(
                id__in=list(org_id_chunk),
                status=OrganizationStatus.ACTIVE,
            )
        )
        eligible = _get_eligible_orgs_from_batch(org_batch)
        for org in eligible:
            delay = int(md5_text(str(org.id)).hexdigest(), 16) % spread_seconds
            run_night_shift_for_org.apply_async(
                args=[org.id],
                kwargs=task_kwargs,
                countdown=delay,
                headers={"sentry-propagate-traces": False},
            )
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
            "schedule_id": schedule_id,
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
    options: SeerNightShiftRunOptionsPartial | None = None,
    project_ids: list[int] | None = None,
    triggering_user_id: int | None = None,
    execute_in_task: bool = False,
    schedule_id: str | None = None,
    **kwargs: Any,
) -> int | None:
    """Run night shift for one organization. `options` is a partial dict —
    any missing fields are filled in by build_run_options. Cron dispatches
    with no options (all defaults); manual triggers (project settings "Run
    Now", admin endpoint) pass `{"source": "manual", ...}` and may scope the
    run to specific projects.

    When execute_in_task is True, the heavy execution phase (eligibility,
    triage, autofix) is dispatched to a separate task so the caller doesn't
    block on it. The run record is created synchronously, except scheduled
    invocations without quota are skipped before creation."""
    organization = Organization.objects.filter(
        id=organization_id, status=OrganizationStatus.ACTIVE
    ).first()
    if organization is None:
        return None

    sentry_sdk.set_tags(
        {"organization_id": organization.id, "organization_slug": organization.slug}
    )

    # Free-cohort orgs receive Night Shift without a subscription.
    has_seer_quota = is_free_cohort_org(organization) or quotas.backend.check_seer_quota(
        org_id=organization.id,
        data_category=DataCategory.SEER_AUTOFIX,
    )
    if not has_seer_quota and schedule_id is not None:
        existing_run = SeerNightShiftRun.objects.filter(
            organization=organization,
            workflow_config__strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE,
            schedule_id=schedule_id,
        ).first()
        if existing_run is None or (
            existing_run.date_completed is None and not existing_run.shards.exists()
        ):
            logger.info("night_shift.no_seer_quota", extra={"organization_id": organization.id})
            return None

    # Manual project runs scope to a single project, whose tweaks feed the run
    # options; cron and org-wide manual runs have no single project.
    single_project_id = project_ids[0] if project_ids and len(project_ids) == 1 else None
    resolved_options = build_run_options(
        organization_id=organization.id,
        manual_overrides=options,
        project_id=single_project_id,
    )
    workflow_config = SeerWorkflowConfig.get_or_create_for_strategy(
        organization_id=organization.id,
        strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE,
    )

    extras: dict[str, object] = {"options": dict(resolved_options)}
    if project_ids is not None:
        extras["target_project_ids"] = project_ids
    if triggering_user_id is not None:
        extras["triggering_user_id"] = triggering_user_id

    created = schedule_id is None
    if schedule_id is None:
        run = SeerNightShiftRun.objects.create(
            organization=organization,
            workflow_config=workflow_config,
            extras=extras,
        )
    else:
        run, created = SeerNightShiftRun.objects.get_or_create(
            organization=organization,
            workflow_config=workflow_config,
            schedule_id=schedule_id,
            defaults={"extras": extras},
        )

    if not created:
        if run.date_completed is not None:
            logger.info(
                "night_shift.duplicate_run_skipped",
                extra={
                    "organization_id": organization.id,
                    "schedule_id": schedule_id,
                    "night_shift_run_id": run.id,
                },
            )
            sentry_sdk.metrics.count("night_shift.duplicate_run_skipped", 1)
            return run.id

        logger.info(
            "night_shift.incomplete_run_resumed",
            extra={
                "organization_id": organization.id,
                "schedule_id": schedule_id,
                "night_shift_run_id": run.id,
            },
        )
        sentry_sdk.metrics.count("night_shift.incomplete_run_resumed", 1)

    if not has_seer_quota and schedule_id is None:
        logger.info("night_shift.no_seer_quota", extra={"organization_id": organization.id})
        _record_run_error(
            run,
            SeerNightShiftRunErrorType.NO_QUOTA,
            "No Seer quota available",
        )
        return run.id

    task_kwargs: dict[str, Any] = {"options": dict(resolved_options)}
    if project_ids is not None:
        task_kwargs["project_ids"] = project_ids

    if execute_in_task:
        run_night_shift_execution.apply_async(args=[run.id], kwargs=task_kwargs)
    else:
        run_night_shift_execution(run.id, **task_kwargs)
    return run.id


@instrumented_task(
    name="sentry.tasks.seer.night_shift.run_night_shift_execution",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_night_shift_execution(
    run_id: int,
    *,
    options: SeerNightShiftRunOptionsPartial | None = None,
    project_ids: list[int] | None = None,
    **kwargs: Any,
) -> None:
    """Heavy phase of a night shift run: eligibility, triage, and optional
    autofix dispatch. Single code path used by both sync invocation (from
    run_night_shift_for_org) and async dispatch (apply_async)."""
    run = SeerNightShiftRun.objects.select_related("organization").filter(id=run_id).first()
    if run is None:
        logger.info("night_shift.missing_run", extra={"night_shift_run_id": run_id})
        return None

    organization = run.organization
    stored_options = (run.extras or {}).get("options")
    resolved_options = _run_option_defaults(
        stored_options if isinstance(stored_options, Mapping) else options or {}
    )

    log_extra: dict[str, object] = {
        "organization_id": organization.id,
        "organization_slug": organization.slug,
        "night_shift_run_id": run.id,
    }
    if project_ids is not None:
        log_extra["project_ids"] = project_ids
    sentry_sdk.set_tags(
        {"organization_id": organization.id, "organization_slug": organization.slug}
    )

    if run.date_completed is not None:
        logger.info("night_shift.execute_already_complete", extra=log_extra)
        return None

    start_time = time.monotonic()
    logger.info("night_shift.execute.start", extra=log_extra)

    if run.shards.exists():
        dispatch_status = _dispatch_pending_shards(run, organization, log_extra, start_time)
        if dispatch_status is not ShardDispatchStatus.COMPLETE:
            logger.info(
                "night_shift.shard_dispatch_incomplete",
                extra={**log_extra, "reason": dispatch_status.value},
            )
            return None
        _complete_run(run)
        return None

    try:
        eligible = _get_eligible_projects(
            organization, resolved_options["source"], project_ids=project_ids
        )
    except Exception:
        _fail_run(
            run,
            error_type=SeerNightShiftRunErrorType.ELIGIBLE_PROJECTS_FAILED,
            message="Failed to get eligible projects",
            event="night_shift.failed_to_get_eligible_projects",
            extra=log_extra,
        )
        return None

    sentry_sdk.metrics.distribution("night_shift.eligible_projects", len(eligible))
    # Stamped so zero-shard runs are distinguishable: no eligible projects vs. no candidates.
    _update_run_extras(run, {"num_eligible_projects": len(eligible)})

    if not eligible:
        logger.info("night_shift.no_eligible_projects", extra=log_extra)
        _complete_run(run)
        return None

    shard_plans, num_candidates = _build_shard_plans(organization, eligible, resolved_options)
    _update_run_extras(run, {"num_candidates": num_candidates})
    if not shard_plans:
        logger.info("night_shift.no_candidates", extra=log_extra)
        _complete_run(run)
        return None

    _maybe_create_shard_plan(run, shard_plans)
    dispatch_status = _dispatch_pending_shards(run, organization, log_extra, start_time)
    if dispatch_status is not ShardDispatchStatus.COMPLETE:
        logger.info(
            "night_shift.shard_dispatch_incomplete",
            extra={**log_extra, "reason": dispatch_status.value},
        )
        return None
    _complete_run(run)


def _night_shift_cron_expr() -> str:
    schedule = settings.TASKWORKER_SCHEDULES["seer-night-shift"]["schedule"]
    if not isinstance(schedule, crontab):
        raise TypeError(
            "The seer-night-shift schedule must use taskbroker_client.scheduler.config.crontab"
        )
    return str(schedule)


def _current_schedule_id(now: datetime, cron_expr: str) -> str:
    """Return the most recent scheduled fire time at or before ``now``."""
    base = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
    return next(CronSim(cron_expr, base, reverse=True)).strftime("%Y-%m-%dT%H:%M")


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


# Run-option fields that a NightShiftTweaks layer can override. `enabled` is
# intentionally excluded — it gates eligibility, it is not a run option.
_TWEAK_RUN_OPTION_FIELDS = (
    "max_candidates",
    "intelligence_level",
    "reasoning_effort",
    "extra_triage_instructions",
)


def _tweaks_to_partial(tweaks: NightShiftTweaks) -> dict[str, Any]:
    """Project a NightShiftTweaks (org- or project-scoped) onto a run-options
    partial, contributing only the fields that were *explicitly* set on it.

    NightShiftTweaks fills every unset field with a default, so reading
    attributes directly would emit all fields and clobber lower-precedence
    layers. `exclude_unset` keeps only the fields the payload actually
    specified, so defaults (and lower layers) show through."""
    set_fields = tweaks.dict(exclude_unset=True)
    return {field: set_fields[field] for field in _TWEAK_RUN_OPTION_FIELDS if field in set_fields}


def build_run_options(
    *,
    organization_id: int,
    manual_overrides: Mapping[str, Any] | None = None,
    project_id: int | None = None,
) -> SeerNightShiftRunOptions:
    """Resolve a fully-populated set of run options, layering by precedence
    (highest wins):

        manual overrides (`manual_overrides`)
        > project tweaks (the project's `sentry:seer_nightshift_tweaks` option,
          applied when `project_id` is given — used by manual project runs)
        > per-org overrides (the `seer.night_shift.org_tweaks` option, keyed by
          `organization_id`)
        > global defaults

    Cron runs pass only `organization_id` (no project, no manual overrides);
    manual project runs additionally pass `project_id` + at least
    `source="manual"`. Unknown keys are ignored."""
    layered: dict[str, Any] = {}
    org_tweaks = get_night_shift_org_tweaks(organization_id)
    if org_tweaks is not None:
        layered.update(_tweaks_to_partial(org_tweaks))
    if project_id is not None:
        project = Project.objects.filter(id=project_id, organization_id=organization_id).first()
        if project is not None:
            layered.update(_tweaks_to_partial(get_night_shift_tweaks(project)))
    layered.update(manual_overrides or {})
    return _run_option_defaults(layered)


def _get_eligible_orgs_from_batch(
    orgs: Sequence[Organization],
) -> list[Organization]:
    """
    Check feature flags for a batch of orgs.
    Returns orgs that have all required feature flags enabled.
    """
    # enable_seer_coding off => night shift can't open a PR for the org.
    enable_coding = OrganizationOption.objects.get_value_bulk(
        orgs, "sentry:enable_seer_coding", ENABLE_SEER_CODING_DEFAULT
    )
    hide_ai = OrganizationOption.objects.get_value_bulk(
        orgs, "sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT
    )
    eligible = [org for org in orgs if enable_coding[org] and not hide_ai[org]]

    for feature_name in BATCH_FEATURE_NAMES:
        batch_result = features.batch_has_for_organizations(feature_name, eligible)
        if batch_result is None:
            raise RuntimeError(f"batch_has_for_organizations returned None for {feature_name}")

        eligible = [org for org in eligible if batch_result.get(f"organization:{org.id}", False)]

        if not eligible:
            return []

    if options.get("seer.night_shift.enable_for_legacy_orgs"):
        return eligible

    # seat-based-seer-enabled: required for paid path, bypassed by free cohort
    paid_eligible: list[Organization] = []
    free_cohort_eligible: list[Organization] = []
    for org in eligible:
        if all(features.has(f, org) for f in PER_ORG_FEATURE_NAMES):
            paid_eligible.append(org)
        elif features.has("organizations:gen-ai-features", org) and is_free_cohort_org(org):
            free_cohort_eligible.append(org)

    return paid_eligible + free_cohort_eligible


def _update_run_extras(
    run: SeerNightShiftRun, updates: Mapping[str, object]
) -> dict[str, object] | None:
    using = router.db_for_write(SeerNightShiftRun)
    with transaction.atomic(using=using):
        locked_run = SeerNightShiftRun.objects.select_for_update().get(id=run.id)
        if locked_run.date_completed is not None:
            return None

        extras = {**(locked_run.extras or {}), **updates}
        locked_run.update(extras=extras)
        run.extras = extras
        return extras


def _complete_run(run: SeerNightShiftRun) -> None:
    using = router.db_for_write(SeerNightShiftRun)
    with transaction.atomic(using=using):
        locked_run = SeerNightShiftRun.objects.select_for_update().get(id=run.id)
        if locked_run.date_completed is not None:
            return

        extras = dict(locked_run.extras or {})
        extras.pop("error_message", None)
        extras.pop("error_type", None)
        locked_run.update(extras=extras, date_completed=timezone.now())


def _record_run_error(
    run: SeerNightShiftRun, error_type: SeerNightShiftRunErrorType, message: str
) -> None:
    _update_run_extras(run, {"error_type": error_type.value, "error_message": message})


def _fail_run(
    run: SeerNightShiftRun,
    *,
    error_type: SeerNightShiftRunErrorType,
    message: str,
    event: str,
    extra: dict[str, object],
) -> None:
    """Log an exception and record an error message on the run."""
    logger.exception(event, extra=extra)
    _record_run_error(run, error_type, message)


@dataclasses.dataclass(frozen=True)
class EligibleProject:
    project: Project
    tweaks: NightShiftTweaks
    stopping_point: AutofixStoppingPoint
    connected_repos: list[str]
    # None for seat-based orgs, regardless of the project's own setting.
    automation_tuning: AutofixAutomationTuningSettings | None


def _get_eligible_projects(
    organization: Organization,
    source: NightShiftRunSource,
    project_ids: list[int] | None = None,
) -> list[EligibleProject]:
    """Return active projects that have automation enabled and connected repos,
    each paired with its parsed night shift tweaks.

    When project_ids is provided, the org's projects are restricted to that set.
    Manual triggers bypass the tweaks.enabled gate — the user explicitly asked
    for this run. Scheduler runs respect it, and are additionally restricted to
    the org's allowed_project_slugs when that override is set."""
    project_qs = Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
    if project_ids is not None:
        project_qs = project_qs.filter(id__in=project_ids)
    if source == "cron":
        org_tweaks = get_night_shift_org_tweaks(organization.id)
        if org_tweaks is not None and org_tweaks.allowed_project_slugs is not None:
            project_qs = project_qs.filter(slug__in=org_tweaks.allowed_project_slugs)
    project_map = {p.id: p for p in project_qs}
    if not project_map:
        return []

    preferences = bulk_read_preferences_from_sentry_db(organization.id, list(project_map))

    is_legacy_org = not is_seer_seat_based_tier_enabled(organization)

    eligible: list[EligibleProject] = []
    for pid, project in project_map.items():
        pref = preferences.get(pid)
        if pref is None:
            continue
        tweaks = get_night_shift_tweaks(project)
        stopping_point = AutofixStoppingPoint(
            pref.automated_run_stopping_point or SEER_AUTOMATED_RUN_STOPPING_POINT_DEFAULT
        )

        reasons: list[str] = []
        if not pref.repositories:
            reasons.append("no_connected_repos")
        if pref.autofix_automation_tuning == AutofixAutomationTuningSettings.OFF:
            reasons.append("automation_tuning_off")
        if source == "cron" and not tweaks.enabled:
            reasons.append("tweaks_disabled")
        if is_legacy_org and is_seer_autotriggered_autofix_rate_limited(project):
            reasons.append("autofix_rate_limited")
        if stopping_point != AutofixStoppingPoint.OPEN_PR:
            # Night shift's only output is a PR, so a project that stops
            # short of open_pr can never produce a usable result.
            reasons.append("not_pr_producing")

        if reasons:
            logger.info(
                "night_shift.project_filtered",
                extra={
                    "organization_id": organization.id,
                    "project_id": pid,
                    "reasons": reasons,
                    "automation_tuning": pref.autofix_automation_tuning.value,
                    "tweaks_enabled": tweaks.enabled,
                    "stopping_point": stopping_point.value,
                },
            )
            continue

        eligible.append(
            EligibleProject(
                project=project,
                tweaks=tweaks,
                stopping_point=stopping_point,
                connected_repos=[f"{repo.owner}/{repo.name}" for repo in pref.repositories],
                automation_tuning=pref.autofix_automation_tuning if is_legacy_org else None,
            )
        )

    return eligible


def _should_use_per_project_quotas(source: NightShiftRunSource, organization_id: int) -> bool:
    """When allowed_project_slugs (org_tweaks) is set, give each project its
    own quota. Manual runs bypass allowed_project_slugs, so never per-project."""
    if source != "cron":
        return False
    org_tweaks = get_night_shift_org_tweaks(organization_id)
    return org_tweaks is not None and org_tweaks.allowed_project_slugs is not None


def _build_shard_plans(
    organization: Organization,
    eligible: Sequence[EligibleProject],
    resolved_options: SeerNightShiftRunOptions,
) -> tuple[list[NightShiftShardPlan], int]:
    eligible_projects = [ep.project for ep in eligible]
    repos_by_project = {ep.project.id: ep.connected_repos for ep in eligible}
    tuning_by_project = {
        ep.project.id: ep.automation_tuning.value
        for ep in eligible
        if ep.automation_tuning is not None
    }
    per_project_quotas = _should_use_per_project_quotas(resolved_options["source"], organization.id)
    score_strategy = (
        fixability_score_strategy_per_project if per_project_quotas else fixability_score_strategy
    )
    scored = score_strategy(eligible_projects, resolved_options["max_candidates"])

    shard_size = max(1, options.get("seer.night_shift.shard_size"))
    chunks = list(chunked(scored, shard_size))
    shard_plans: list[NightShiftShardPlan] = []
    for shard_index, chunk in enumerate(chunks):
        payload = NightShiftPayload(
            candidates=[
                TriageCandidate(
                    group_id=candidate.group.id,
                    title=candidate.group.title,
                    culprit=candidate.group.culprit,
                    fixability=candidate.fixability,
                    times_seen=candidate.group.times_seen,
                    first_seen=candidate.group.first_seen.isoformat(),
                    priority=priority_label(candidate.group.priority),
                    connected_repos=repos_by_project.get(candidate.group.project_id, []),
                    automation_tuning=tuning_by_project.get(candidate.group.project_id),
                )
                for candidate in chunk
            ],
            tweaks=TriageTweaks(
                intelligence_level=resolved_options["intelligence_level"],
                reasoning_effort=resolved_options["reasoning_effort"],
                extra_triage_instructions=resolved_options["extra_triage_instructions"],
            ),
        )
        num_candidates = len(payload.candidates)
        title = ngettext(
            "Agentic triage (%(count)d candidate)",
            "Agentic triage (%(count)d candidates)",
            num_candidates,
        ) % {"count": num_candidates}
        if len(chunks) > 1:
            title += f" — part {shard_index + 1} of {len(chunks)}"
        shard_plans.append(NightShiftShardPlan(payload=payload.dict(), title=title))

    return shard_plans, len(scored)


def _maybe_create_shard_plan(
    run: SeerNightShiftRun, shard_plans: Sequence[NightShiftShardPlan]
) -> None:
    using = router.db_for_write(SeerNightShiftRunShard)
    with transaction.atomic(using=using):
        locked_run = SeerNightShiftRun.objects.select_for_update().get(id=run.id)
        if locked_run.shards.exists():
            return

        SeerNightShiftRunShard.objects.bulk_create(
            [
                SeerNightShiftRunShard(run=locked_run, extras=plan.to_extras())
                for plan in shard_plans
            ]
        )


def _dispatch_pending_shards(
    run: SeerNightShiftRun,
    organization: Organization,
    log_extra: dict[str, object],
    start_time: float,
) -> ShardDispatchStatus:
    """Dispatch every unlinked shard and return its durable completion status."""
    try:
        client = SeerAgentClient(organization)
    except SeerPermissionError:
        logger.info("night_shift.no_seer_access", extra=log_extra)
        _record_run_error(
            run,
            SeerNightShiftRunErrorType.NO_SEER_ACCESS,
            "Organization does not have Seer access",
        )
        return ShardDispatchStatus.NO_SEER_ACCESS

    using = router.db_for_write(SeerNightShiftRunShard)
    planned_shards = list(run.shards.order_by("id"))
    dispatched = 0
    for shard_index, planned_shard in enumerate(planned_shards):
        with transaction.atomic(using=using):
            shard = SeerNightShiftRunShard.objects.select_for_update().get(id=planned_shard.id)
            if shard.seer_run_id is not None:
                dispatched += 1
                continue

            shard_plan = NightShiftShardPlan.from_extras(shard.extras)
            if shard_plan is None:
                logger.error(
                    "night_shift.invalid_shard_plan",
                    extra={**log_extra, "shard_index": shard_index},
                )
                _record_run_error(
                    run,
                    SeerNightShiftRunErrorType.INVALID_SHARD_PLAN,
                    "Invalid Night Shift shard plan",
                )
                return ShardDispatchStatus.INVALID_SHARD_PLAN

            def _link_shard(created: SeerRun) -> None:
                shard.seer_run = created
                shard.save(update_fields=["seer_run"])

            try:
                client.start_feature_run(
                    feature_id="night_shift",
                    payload=shard_plan.payload,
                    title=shard_plan.title,
                    flush=False,
                    on_run_created=_link_shard,
                    referrer="night_shift",
                )
            except Exception:
                logger.exception(
                    "night_shift.shard_dispatch_failed",
                    extra={
                        **log_extra,
                        "shard_index": shard_index,
                        "num_shards": len(planned_shards),
                    },
                )
                continue
            dispatched += 1

    if dispatched != len(planned_shards):
        failed_shards = len(planned_shards) - dispatched
        sentry_sdk.metrics.count("night_shift.shard_dispatch_failure", failed_shards)
        _record_run_error(
            run,
            SeerNightShiftRunErrorType.SHARD_DISPATCH_FAILED,
            f"Failed to dispatch {failed_shards} of {len(planned_shards)} triage shards",
        )
        logger.warning(
            "night_shift.partial_dispatch_failure",
            extra={
                **log_extra,
                "num_shards": len(planned_shards),
                "num_shards_dispatched": dispatched,
            },
        )
        return ShardDispatchStatus.PARTIAL_FAILURE

    sentry_sdk.metrics.distribution("night_shift.org_run_duration", time.monotonic() - start_time)
    logger.info(
        "night_shift.feature_dispatched",
        extra={
            **log_extra,
            "num_eligible_projects": (run.extras or {}).get("num_eligible_projects"),
            "num_candidates": (run.extras or {}).get("num_candidates"),
            "num_shards": len(planned_shards),
            "num_shards_dispatched": dispatched,
        },
    )
    return ShardDispatchStatus.COMPLETE

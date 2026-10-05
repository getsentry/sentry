from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Callable, Generator
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from functools import partial
from itertools import batched

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidSearchQuery
from sentry.llm_cache_detection.detection import (
    FLAGGED_OUTCOMES,
    CacheFinding,
    CallSiteStats,
    Classification,
    DetectionWindow,
    ProbeGap,
    PromptDiagnosisGap,
    PromptDivergence,
    classify_call_site,
    diagnose_prompt_divergence,
    find_contrast_anchor,
    needs_cache_presence_probe,
    resolve_with_cache_presence,
    resolve_with_warmth,
)
from sentry.llm_cache_detection.pricing import estimate_savings
from sentry.llm_cache_detection.query import (
    SampleCall,
    count_spans_with_cache_attributes,
    fetch_call_site_stats,
    fetch_call_site_warmth,
    fetch_sample_calls,
    fetch_sample_prompts,
)
from sentry.llm_cache_detection.reporting import (
    CandidateReport,
    Disposition,
    report_fan_out_skipped,
    report_probe_failed,
    report_project,
    report_projects_dispatched,
    report_projects_skipped,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.relay.config.ai_model_costs import ai_model_metadata_config
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba_rpc import SnubaRPCError

logger = logging.getLogger("sentry.tasks.llm_cache_issue_detection")

LLM_CACHE_DETECTION_FEATURE = "organizations:llm-cache-detection"

# Mirrors the per-project creation quota the issue type will have.
FINDINGS_PER_PROJECT_LIMIT = 5

# Keeps the sequential probe queries inside the processing deadline. Presence is
# only probed after a warmth probe answered, so this bounds it as well.
MAX_WARMTH_PROBES_PER_PROJECT = 20

PROJECTS_PER_BATCH = 1_000

# Failures scoped to the call site a query was about, so the run goes on.
PROBE_ERRORS = (SnubaRPCError, InvalidSearchQuery)


@dataclass
class ProbeBudget:
    limit: int
    sent: int = 0


def _probe[T](
    project: Project,
    name: str,
    query: Callable[[], T | None],
    budget: ProbeBudget | None = None,
) -> T | ProbeGap:
    """Run one probe query, turning each way it can go unanswered into a gap.

    Only a query that reached EAP is charged: charging for the rest would let a
    handful of unexpressible call sites spend the whole budget.
    """
    if budget is not None and budget.sent >= budget.limit:
        return ProbeGap.BUDGET_EXHAUSTED
    try:
        answer = query()
    except PROBE_ERRORS as error:
        if budget is not None:
            budget.sent += 1
        report_probe_failed(project, name, error)
        logger.warning(
            "llm_cache_issue_detection.probe_failed",
            extra={"project_id": project.id, "probe": name},
            exc_info=True,
        )
        return ProbeGap.FAILED
    if answer is None:
        return ProbeGap.UNQUERYABLE
    if budget is not None:
        budget.sent += 1
    return answer


def _diagnose_prompts(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> PromptDivergence | PromptDiagnosisGap:
    """Reduce a call site's sampled prompts to a diagnosis of where they diverge.

    Prompts are customer content, so the text is confined to this frame and
    nothing raised inside it may leave: a captured traceback records the locals
    of every frame it unwinds. A failure is logged by type, without traceback.
    """
    try:
        prompts = fetch_sample_prompts(project, stats, window)
        if prompts is None:
            return PromptDiagnosisGap.UNQUERYABLE
        if not prompts:
            return PromptDiagnosisGap.NO_PROMPT_TEXT
        divergence = diagnose_prompt_divergence(prompts)
    except Exception as error:
        logger.warning(
            "llm_cache_issue_detection.prompt_diagnosis_failed",
            extra={"project_id": project.id, "error": type(error).__name__},
        )
        return PromptDiagnosisGap.FAILED
    if divergence is None:
        return PromptDiagnosisGap.TOO_FEW_SAMPLES
    return divergence


def _resolve_candidate(
    project: Project,
    candidate: CacheFinding,
    window: DetectionWindow,
    warmth_budget: ProbeBudget,
) -> CacheFinding:
    """Settle what the token sums could not: whether the cache could warm, then
    whether zero cache tokens are a real zero."""
    warmth = _probe(
        project,
        "warmth",
        partial(fetch_call_site_warmth, project, candidate.stats, window),
        warmth_budget,
    )
    finding = replace(
        candidate,
        classification=resolve_with_warmth(candidate.classification, warmth),
        warmth=warmth,
    )
    if not needs_cache_presence_probe(finding.classification):
        return finding

    presence = _probe(
        project,
        "cache_presence",
        partial(count_spans_with_cache_attributes, project, finding.stats, window),
    )
    return replace(
        finding,
        classification=resolve_with_cache_presence(finding.classification, presence),
        spans_with_cache_attributes=presence,
    )


def _is_scheduled_run(now: datetime) -> bool:
    """Whether this hourly tick is one the configured interval runs on, counted
    since the epoch so intervals that do not divide 24 stay evenly spaced."""
    interval_hours = max(options.get("issue-detection.llm-cache-detection.interval-hours"), 1)
    return int(now.timestamp() // 3600) % interval_hours == 0


def _projects_with_agent_spans(skipped: Counter[str]) -> Generator[tuple[int, int]]:
    """Stream (project_id, organization_id) for projects that have sent gen-AI spans."""
    active_projects = RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE).values_list(
            "id", "organization_id", "flags"
        ),
        result_value_getter=lambda item: item[0],
    )
    for project_id, organization_id, flags in active_projects:
        # Set by ingest for any `gen_ai` span op, a superset of what detection reads.
        if flags & Project.flags.has_insights_agent_monitoring:
            yield project_id, organization_id
        else:
            skipped["no_agent_spans"] += 1


@instrumented_task(
    name="sentry.tasks.llm_cache_issue_detection.run_llm_cache_issue_detection",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def run_llm_cache_issue_detection() -> None:
    """Fan out per-project detection tasks for orgs with the feature enabled."""
    if not _is_scheduled_run(datetime.now(UTC)):
        report_fan_out_skipped("interval")
        return

    skipped: Counter[str] = Counter()
    dispatched_count = 0

    for batch in batched(_projects_with_agent_spans(skipped), PROJECTS_PER_BATCH):
        # Evaluated once per organization in the batch, not per project.
        enabled_organization_ids = {
            organization.id
            for organization in Organization.objects.filter(
                id__in={organization_id for _, organization_id in batch}
            )
            if features.has(LLM_CACHE_DETECTION_FEATURE, organization)
        }

        for project_id, organization_id in batch:
            if organization_id in enabled_organization_ids:
                detect_llm_cache_issues_for_project.delay(project_id)
                dispatched_count += 1
            else:
                skipped["detection_disabled"] += 1

    # Only reasons that skipped something have an entry, since zero skips are
    # noise; a zero dispatch count is the signal that nothing went out.
    for reason, amount in skipped.items():
        report_projects_skipped(reason, amount)
    report_projects_dispatched(dispatched_count)

    logger.info(
        "llm_cache_issue_detection.fan_out_completed",
        extra={
            "projects_without_agent_spans": skipped["no_agent_spans"],
            "projects_considered": dispatched_count + skipped["detection_disabled"],
            "projects_dispatched": dispatched_count,
        },
    )


@instrumented_task(
    name="sentry.tasks.llm_cache_issue_detection.detect_llm_cache_issues_for_project",
    namespace=issues_tasks,
    processing_deadline_duration=300,
)
def detect_llm_cache_issues_for_project(project_id: int) -> None:
    """Classify a project's gen-AI call sites and report what detection would file."""
    try:
        project = Project.objects.select_related("organization").get(id=project_id)
    except Project.DoesNotExist:
        logger.warning("Project does not exist", extra={"project_id": project_id})
        return

    if not features.has(LLM_CACHE_DETECTION_FEATURE, project.organization):
        report_projects_skipped("detection_disabled")
        return

    window = DetectionWindow.ending_now()
    query_result = fetch_call_site_stats(project, window)

    non_candidates: list[tuple[CallSiteStats, Classification]] = []
    candidates: list[CacheFinding] = []
    for stats in query_result.call_sites:
        classification = classify_call_site(stats)
        if classification.outcome in FLAGGED_OUTCOMES:
            candidates.append(
                CacheFinding(
                    classification=classification,
                    stats=stats,
                    anchor=find_contrast_anchor(stats, query_result.call_sites),
                )
            )
        else:
            non_candidates.append((stats, classification))

    # The probe budget and the findings cap go to the worst offenders first.
    candidates.sort(key=lambda finding: finding.severity, reverse=True)

    warmth_budget = ProbeBudget(MAX_WARMTH_PROBES_PER_PROJECT)
    # One snapshot of every model's prices, so all findings are priced alike.
    model_metadata = ai_model_metadata_config()

    reports: list[CandidateReport] = []
    findings_count = 0
    for rank, candidate in enumerate(candidates, start=1):
        finding = _resolve_candidate(project, candidate, window, warmth_budget)
        if finding.outcome not in FLAGGED_OUTCOMES:
            reports.append(
                CandidateReport(finding=finding, initial=candidate.classification, rank=rank)
            )
            continue

        findings_count += 1
        disposition = (
            Disposition.WOULD_CREATE
            if findings_count <= FINDINGS_PER_PROJECT_LIMIT
            else Disposition.OVER_CAP
        )
        sample_calls: list[SampleCall] | ProbeGap | None = None
        prompt_diagnosis: PromptDivergence | PromptDiagnosisGap | None = None
        # Only what would be filed is sampled, so the cap bounds these queries.
        if disposition is Disposition.WOULD_CREATE:
            sample_calls = _probe(
                project,
                "sample_calls",
                partial(fetch_sample_calls, project, finding.stats, window),
            )
            prompt_diagnosis = _diagnose_prompts(project, finding.stats, window)
        reports.append(
            CandidateReport(
                finding=finding,
                initial=candidate.classification,
                rank=rank,
                disposition=disposition,
                pricing=estimate_savings(finding, model_metadata),
                sample_calls=sample_calls,
                prompt_diagnosis=prompt_diagnosis,
            )
        )

    report_project(
        project,
        window,
        query_result,
        non_candidates,
        reports,
        warmth_probes_sent=warmth_budget.sent,
    )

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Generator
from dataclasses import replace
from itertools import batched

from sentry import features
from sentry.constants import ObjectStatus
from sentry.issues.grouptype import LLMCacheUsageGroupType
from sentry.llm_cache_detection.detection import (
    FLAGGED_OUTCOMES,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
    DetectionWindow,
    PromptDivergence,
    classify_call_site,
    diagnose_prompt_divergence,
    find_contrast_anchor,
    needs_cache_presence_probe,
    resolve_with_cache_presence,
    resolve_with_warmth,
)
from sentry.llm_cache_detection.issue_platform_adapter import (
    check_llm_cache_issue_already_speaks_for,
    create_fingerprint,
    send_llm_cache_issue_to_platform,
)
from sentry.llm_cache_detection.pricing import ModelPricebook
from sentry.llm_cache_detection.query import (
    count_spans_with_cache_attributes,
    fetch_call_site_stats,
    fetch_call_site_warmth,
    fetch_sample_calls,
    fetch_sample_prompts,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.llm_cache_issue_detection")

LLM_CACHE_DETECTION_FEATURE = "organizations:llm-cache-detection"

# Matches the group type's default creation quota (5/hour/project): anything
# beyond it would be rate-limit-dropped by the occurrence consumer anyway.
FINDINGS_PER_PROJECT_LIMIT = 5
# Bound the sequential EAP probe queries so the task fits its processing
# deadline. Warmth is asked of every candidate and presence only of the
# ambiguous ones, so each gets a budget of its own rather than sharing a pool
# that whichever ran first would drain.
MAX_WARMTH_PROBES_PER_PROJECT = 20
MAX_PRESENCE_PROBES_PER_PROJECT = 20
# Caps how many projects the fan-out holds in memory and how many organizations
# a single dispatch round resolves.
PROJECTS_PER_BATCH = 1_000


def _record_projects_skipped(reason: str, amount: int = 1) -> None:
    metrics.incr(
        "llm_cache_issue_detection.projects.skipped",
        amount=amount,
        tags={"reason": reason},
        sample_rate=1.0,
    )


def _diagnose_prompts(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> PromptDivergence | None:
    """Reduce a call site's sampled prompts to a diagnosis of where they diverge.

    Fetching and reducing are one step on purpose. Prompts are customer content
    and everything derived from them is a measurement, so the text is confined
    to a frame that does nothing else: any traceback raised further up -- from
    producing the occurrence, most of all -- records the locals of the frames
    it unwinds, and this keeps the prompts out of every one of them.
    """
    prompts = fetch_sample_prompts(project, stats, window)
    return diagnose_prompt_divergence(prompts or ())


def _projects_with_agent_spans(skipped: Counter[str]) -> Generator[tuple[int, int]]:
    """Stream (project_id, organization_id) for projects that have sent gen-AI spans."""
    active_projects = RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE).values_list(
            "id", "organization_id", "flags"
        ),
        result_value_getter=lambda item: item[0],
    )
    for project_id, organization_id, flags in active_projects:
        # Ingest sets this flag for any span whose op starts with `gen_ai`, so it
        # is a superset of the generate_content spans detection reads: a project
        # without it cannot produce a finding.
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
    skipped: Counter[str] = Counter()
    candidate_count = 0
    dispatched_count = 0

    for batch in batched(_projects_with_agent_spans(skipped), PROJECTS_PER_BATCH):
        candidate_count += len(batch)
        # A batch is dominated by projects sharing an organization, so resolve and
        # flag-evaluate each one once: the cost scales with organizations in the
        # batch rather than with projects.
        enabled_organization_ids = {
            organization.id
            for organization in Organization.objects.filter(
                id__in={organization_id for _, organization_id in batch}
            )
            if features.has(LLM_CACHE_DETECTION_FEATURE, organization)
        }

        for project_id, organization_id in batch:
            if organization_id not in enabled_organization_ids:
                continue
            detect_llm_cache_issues_for_project.delay(project_id)
            dispatched_count += 1

    # Reason tallies are only emitted when they happened; a zero for a reason is
    # noise. The dispatch count is emitted unconditionally: it is the fan-out's
    # headline output, and a zero there is the signal that nothing went out.
    for reason, amount in (
        ("no_agent_spans", skipped["no_agent_spans"]),
        ("detection_disabled", candidate_count - dispatched_count),
    ):
        if amount > 0:
            _record_projects_skipped(reason, amount)
    metrics.incr(
        "llm_cache_issue_detection.projects.dispatched",
        amount=dispatched_count,
        sample_rate=1.0,
    )

    logger.info(
        "llm_cache_issue_detection.fan_out_completed",
        extra={
            "projects_without_agent_spans": skipped["no_agent_spans"],
            "projects_considered": candidate_count,
            "projects_dispatched": dispatched_count,
        },
    )


@instrumented_task(
    name="sentry.tasks.llm_cache_issue_detection.detect_llm_cache_issues_for_project",
    namespace=issues_tasks,
    processing_deadline_duration=300,
)
def detect_llm_cache_issues_for_project(project_id: int) -> None:
    """Classify a project's gen-AI call sites and produce occurrences for flagged ones."""
    try:
        project = Project.objects.select_related("organization").get(id=project_id)
    except Project.DoesNotExist:
        logger.warning("Project does not exist", extra={"project_id": project_id})
        return

    # Tallied apart because they mean different things: detection decides whether
    # an org is scanned, the group type whether a finding may be filed. During
    # rollout the first is on while the second is not, and one shared reason
    # cannot tell that steady state from the flag being off.
    if not features.has(LLM_CACHE_DETECTION_FEATURE, project.organization):
        _record_projects_skipped("detection_disabled")
        return

    if not LLMCacheUsageGroupType.allow_ingest(project.organization):
        _record_projects_skipped("ingest_disabled")
        return

    # One window for the whole run so the aggregates, the probes and the sampled
    # calls all describe the same stretch of time.
    window = DetectionWindow.ending_now()
    all_stats = fetch_call_site_stats(project, window)

    candidates: list[CacheFinding] = []
    outcome_counts: Counter[CacheOutcome] = Counter()
    for stats in all_stats:
        outcome = classify_call_site(stats)
        outcome_counts[outcome] += 1

        if outcome in FLAGGED_OUTCOMES:
            candidates.append(
                CacheFinding(
                    outcome=outcome,
                    stats=stats,
                    anchor=find_contrast_anchor(stats, all_stats),
                )
            )

    # Consider candidates in severity order so both the findings cap and the
    # probe budget are spent on the worst offenders first.
    candidates.sort(key=lambda finding: finding.severity, reverse=True)

    findings: list[CacheFinding] = []
    warmth_probes_remaining = MAX_WARMTH_PROBES_PER_PROJECT
    presence_probes_remaining = MAX_PRESENCE_PROBES_PER_PROJECT
    rejected_already_exists_count = 0
    for candidate in candidates:
        if len(findings) >= FINDINGS_PER_PROJECT_LIMIT:
            break
        # Dedupe first: a candidate with an open issue can neither take a slot
        # under the cap nor produce an occurrence, so probing it would spend a
        # query -- and on a project with several open issues, the whole probe
        # budget -- resolving an outcome nothing goes on to read.
        if check_llm_cache_issue_already_speaks_for(
            project, create_fingerprint(candidate.stats), window
        ):
            rejected_already_exists_count += 1
            continue
        # An unqueryable call site and an exhausted budget both leave a probe
        # unanswered, which either resolver reads conservatively. Only a query
        # that actually reached EAP is charged: charging for the rest would let
        # a handful of unexpressible call sites spend the whole budget.
        #
        # Warmth is asked first because it can reject outright -- a call site
        # whose calls arrive too far apart to meet a warm cache is not a finding
        # -- which spares the rejected ones a presence probe as well.
        warmth = (
            fetch_call_site_warmth(project, candidate.stats, window)
            if warmth_probes_remaining > 0
            else None
        )
        if warmth is not None:
            warmth_probes_remaining -= 1
        resolved = resolve_with_warmth(candidate.outcome, warmth)
        if resolved != candidate.outcome:
            outcome_counts[candidate.outcome] -= 1
            outcome_counts[resolved] += 1
            continue

        finding = replace(candidate, warmth=warmth)
        if needs_cache_presence_probe(finding.stats, finding.outcome):
            presence = (
                count_spans_with_cache_attributes(project, finding.stats, window)
                if presence_probes_remaining > 0
                else None
            )
            if presence is not None:
                presence_probes_remaining -= 1
            resolved = resolve_with_cache_presence(finding.outcome, presence)
            if resolved != finding.outcome:
                outcome_counts[finding.outcome] -= 1
                outcome_counts[resolved] += 1
                continue
        findings.append(finding)

    for outcome, count in outcome_counts.items():
        if count <= 0:
            continue
        metrics.incr(
            "llm_cache_issue_detection.call_sites.classified",
            amount=count,
            tags={"outcome": outcome.value},
            sample_rate=1.0,
        )

    if findings:
        # Prices come from a single cache entry covering every model, so one load
        # serves every finding in the run.
        pricebook = ModelPricebook.load()
        for finding in findings:
            # Both of these run once per finding, and the loop is already bounded
            # by FINDINGS_PER_PROJECT_LIMIT. The probes above needed budgets of
            # their own because they run over candidates, of which there can be
            # hundreds; here the cap is the budget.
            sample_calls = fetch_sample_calls(project, finding.stats, window)
            savings = pricebook.estimate(finding)
            divergence = _diagnose_prompts(project, finding.stats, window)
            send_llm_cache_issue_to_platform(
                project, finding, sample_calls, window, savings, divergence
            )
            metrics.incr(
                "llm_cache_issue_detection.issues.sent",
                tags={"kind": finding.outcome.value},
                sample_rate=1.0,
            )

    if rejected_already_exists_count:
        metrics.incr(
            "llm_cache_issue_detection.rejected",
            amount=rejected_already_exists_count,
            tags={"reason": "already_exists"},
            sample_rate=1.0,
        )

    logger.info(
        "llm_cache_issue_detection.project_processed",
        extra={
            "project_id": project.id,
            "organization_id": project.organization_id,
            "call_site_count": len(all_stats),
            "outcome_counts": {outcome.value: count for outcome, count in outcome_counts.items()},
            "issues_sent": len(findings),
        },
    )

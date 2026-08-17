from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Generator
from itertools import batched

from sentry import features
from sentry.constants import ObjectStatus
from sentry.issues.grouptype import LLMCacheUsageGroupType
from sentry.llm_cache_detection.detection import (
    FLAGGED_OUTCOMES,
    CacheFinding,
    CacheOutcome,
    classify_call_site,
    find_contrast_anchor,
    needs_cache_presence_probe,
    resolve_with_cache_presence,
)
from sentry.llm_cache_detection.issue_platform_adapter import (
    check_unresolved_llm_cache_issue_exists,
    create_fingerprint,
    send_llm_cache_issue_to_platform,
)
from sentry.llm_cache_detection.query import (
    count_spans_with_cache_attributes,
    fetch_call_site_stats,
    fetch_sample_trace_ids,
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
# Bounds sequential EAP probe queries so the task fits its processing deadline.
MAX_PRESENCE_PROBES_PER_PROJECT = 20
# Caps how many projects the fan-out holds in memory and how many organizations
# a single dispatch round resolves.
PROJECTS_PER_BATCH = 1_000


def _all_active_projects_with_flags() -> Generator[tuple[int, int, int]]:
    yield from RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE).values_list(
            "id", "organization_id", "flags"
        ),
        result_value_getter=lambda item: item[0],
    )


def _projects_with_agent_spans(skipped: Counter[str]) -> Generator[tuple[int, int]]:
    """Stream (project_id, organization_id) for projects that have sent gen-AI spans."""
    for project_id, organization_id, flags in _all_active_projects_with_flags():
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

    metrics.incr(
        "llm_cache_issue_detection.projects.skipped",
        amount=skipped["no_agent_spans"],
        tags={"reason": "no_agent_spans"},
        sample_rate=1.0,
    )
    metrics.incr(
        "llm_cache_issue_detection.projects.skipped",
        amount=candidate_count - dispatched_count,
        tags={"reason": "feature_disabled"},
        sample_rate=1.0,
    )
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

    if not (
        features.has(LLM_CACHE_DETECTION_FEATURE, project.organization)
        and LLMCacheUsageGroupType.allow_ingest(project.organization)
    ):
        metrics.incr(
            "llm_cache_issue_detection.projects.skipped",
            tags={"reason": "feature_disabled"},
            sample_rate=1.0,
        )
        return

    all_stats = fetch_call_site_stats(project)

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

    # Probe the instrumentation-gap guard in severity order so the query budget
    # is spent only on candidates that can still become findings.
    candidates.sort(key=lambda finding: finding.severity, reverse=True)

    # Dedupe before applying the findings cap: already-open issues must not
    # consume slots, or the same top offenders would starve new findings on
    # every subsequent run.
    findings: list[CacheFinding] = []
    probes_run = 0
    rejected_already_exists_count = 0
    for candidate in candidates:
        if len(findings) >= FINDINGS_PER_PROJECT_LIMIT:
            break
        if needs_cache_presence_probe(candidate.stats, candidate.outcome):
            if probes_run >= MAX_PRESENCE_PROBES_PER_PROJECT:
                # Out of probe budget: presence is unknowable, so be conservative.
                resolved = CacheOutcome.UNKNOWN
            else:
                probes_run += 1
                resolved = resolve_with_cache_presence(
                    candidate.outcome, count_spans_with_cache_attributes(project, candidate.stats)
                )
            if resolved != candidate.outcome:
                outcome_counts[candidate.outcome] -= 1
                outcome_counts[resolved] += 1
                continue
        if check_unresolved_llm_cache_issue_exists(
            project, create_fingerprint(candidate.outcome, candidate.stats)
        ):
            rejected_already_exists_count += 1
            continue
        findings.append(candidate)

    for outcome, count in outcome_counts.items():
        if count <= 0:
            continue
        metrics.incr(
            "llm_cache_issue_detection.call_sites.classified",
            amount=count,
            tags={"outcome": outcome.value},
            sample_rate=1.0,
        )

    sent_count = 0
    for finding in findings:
        sample_trace_ids = fetch_sample_trace_ids(project, finding.stats)
        send_llm_cache_issue_to_platform(project, finding, sample_trace_ids)
        sent_count += 1
        metrics.incr(
            "llm_cache_issue_detection.issues.sent",
            tags={"kind": finding.outcome.value},
            sample_rate=1.0,
        )

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
            "issues_sent": sent_count,
        },
    )

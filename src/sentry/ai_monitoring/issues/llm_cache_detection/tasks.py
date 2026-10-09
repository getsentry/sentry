from __future__ import annotations

import logging
from datetime import timedelta
from functools import partial
from time import monotonic

from django.db.models import F

from sentry import features
from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    FLAGGED_OUTCOMES,
    CacheFinding,
    CallSiteStats,
    Classification,
    DetectionWindow,
    ProbeGap,
    classify_call_site,
)
from sentry.ai_monitoring.issues.llm_cache_detection.pricing import estimate_savings
from sentry.ai_monitoring.issues.llm_cache_detection.query import (
    SampleCall,
    fetch_call_site_stats,
    fetch_sample_calls,
)
from sentry.ai_monitoring.issues.llm_cache_detection.reporting import (
    CandidateReport,
    Disposition,
    report_project,
)
from sentry.ai_monitoring.issues.llm_cache_detection.resolution import (
    ProbeBudget,
    probe,
    resolve_candidate,
)
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.relay.config.ai_model_costs import ai_model_metadata_config
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils.cursored_scheduler import CursoredScheduler

logger = logging.getLogger(__name__)

DETECTION_FEATURE = "organizations:llm-cache-issue-detection"
FINDINGS_PER_PROJECT_LIMIT = 5
MAX_WARMTH_PROBES_PER_PROJECT = 20
PROJECT_PROCESSING_DEADLINE_SECS = 300
DETECTION_CYCLE_DURATION = timedelta(hours=1)
SCHEDULE_KEY = "llm-cache-issue-detection"


@instrumented_task(
    name="sentry.ai_monitoring.issues.llm_cache_detection.tasks.run_llm_cache_issue_detection",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def run_llm_cache_issue_detection() -> None:
    """Schedule one detection cycle across active Agent Monitoring projects."""
    CursoredScheduler(
        name="llm_cache_issue_detection",
        schedule_key=SCHEDULE_KEY,
        queryset=Project.objects.filter(
            status=ObjectStatus.ACTIVE,
            flags=F("flags").bitor(Project.flags.has_insights_agent_monitoring),
        ),
        task=detect_llm_cache_issues_for_project,
        cycle_duration=DETECTION_CYCLE_DURATION,
    ).tick()


@instrumented_task(
    name=(
        "sentry.ai_monitoring.issues.llm_cache_detection.tasks.detect_llm_cache_issues_for_project"
    ),
    namespace=issues_tasks,
    processing_deadline_duration=PROJECT_PROCESSING_DEADLINE_SECS,
)
def detect_llm_cache_issues_for_project(project_id: int) -> None:
    """Classify one project's LLM call sites and log shadow findings."""
    try:
        project = Project.objects.select_related("organization").get(id=project_id)
    except Project.DoesNotExist:
        logger.warning("Project does not exist", extra={"project_id": project_id})
        return

    if not features.has(DETECTION_FEATURE, project.organization):
        logger.info(
            "llm_cache_issue_detection.project_skipped",
            extra={
                "project_id": project.id,
                "organization_id": project.organization_id,
                "reason": "detection_disabled",
            },
        )
        return

    # Leave one minute for an in-flight query and final reporting.
    deadline = monotonic() + PROJECT_PROCESSING_DEADLINE_SECS - 60
    window = DetectionWindow.ending_now()
    query_result = fetch_call_site_stats(project, window)

    non_candidates: list[tuple[CallSiteStats, Classification]] = []
    candidates: list[CacheFinding] = []
    for stats in query_result.call_sites:
        classification = classify_call_site(stats)
        if classification.outcome in FLAGGED_OUTCOMES:
            candidates.append(CacheFinding(classification=classification, stats=stats))
        else:
            non_candidates.append((stats, classification))
    candidates.sort(key=lambda finding: finding.severity, reverse=True)

    warmth_budget = ProbeBudget(MAX_WARMTH_PROBES_PER_PROJECT)
    model_metadata = ai_model_metadata_config()
    reports: list[CandidateReport] = []
    findings_count = 0
    for rank, candidate in enumerate(candidates, start=1):
        finding = resolve_candidate(project, candidate, window, deadline, warmth_budget)
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
        if disposition is Disposition.WOULD_CREATE:
            sample_calls = probe(
                project,
                "sample_calls",
                partial(fetch_sample_calls, project, finding.stats, window),
                deadline,
            )
        reports.append(
            CandidateReport(
                finding=finding,
                initial=candidate.classification,
                rank=rank,
                disposition=disposition,
                pricing=estimate_savings(finding, model_metadata),
                sample_calls=sample_calls,
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

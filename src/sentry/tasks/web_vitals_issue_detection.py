from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Generator
from datetime import UTC, datetime, timedelta

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.issue_detection.performance_detection import get_merged_settings
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.autofix.utils import get_autofix_repos_from_project_code_mappings
from sentry.seer.constants import SEER_SUPPORTED_SCM_PROVIDERS
from sentry.seer.explorer.utils import normalize_description
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.web_vitals.issue_platform_adapter import send_web_vitals_issue_to_platform
from sentry.web_vitals.query import get_trace_by_web_vital_measurement
from sentry.web_vitals.types import (
    WebVitalIssueDetectionGroupingType,
    WebVitalIssueDetectionType,
    WebVitalIssueGroupData,
)

logger = logging.getLogger("sentry.tasks.web_vitals_issue_detection")

PROJECTS_PER_BATCH = 1_000
TRANSACTIONS_PER_PROJECT_LIMIT = 5
DEFAULT_START_TIME_DELTA = {"days": 7}  # Low scores within this time range create web vital issues
SCORE_THRESHOLD = 0.9  # Scores below this threshold will create web vital issues
DEFAULT_SAMPLES_COUNT_THRESHOLD = 10
VITALS: list[WebVitalIssueDetectionType] = ["lcp", "fcp", "cls", "ttfb", "inp"]
VITAL_GROUPING_MAP: dict[WebVitalIssueDetectionType, WebVitalIssueDetectionGroupingType] = {
    "lcp": "rendering",
    "fcp": "rendering",
    "ttfb": "rendering",
    "cls": "cls",
    "inp": "inp",
}


def all_active_projects_with_flags() -> Generator[tuple[int, int]]:
    yield from RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE).values_list("id", "flags"),
        result_value_getter=lambda item: item[0],
    )


@instrumented_task(
    name="sentry.tasks.web_vitals_issue_detection.run_web_vitals_issue_detection",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def run_web_vitals_issue_detection() -> None:
    """
    Main scheduled task for Web Vitals issue detection.
    """
    if not options.get("issue-detection.web-vitals-detection.enabled"):
        return

    project_ids_generator = all_active_projects_with_flags()

    project_ids_batch = []
    for project_id, flags in project_ids_generator:
        if flags & Project.flags.has_transactions:
            project_ids_batch.append(project_id)

        if len(project_ids_batch) >= PROJECTS_PER_BATCH:
            dispatch_detection_for_project_ids(project_ids_batch)
            project_ids_batch = []

    # Last batch
    if project_ids_batch:
        dispatch_detection_for_project_ids(project_ids_batch)


# Returns a list of tuples of (project_id, success)
def dispatch_detection_for_project_ids(
    project_ids: list[int],
) -> dict[int, dict[str, bool | str | None]]:
    # Spawn a sub-task for each project
    projects = Project.objects.filter(id__in=project_ids).select_related("organization")
    projects_checked_count = 0
    projects_dispatched_count = 0
    results: dict[int, dict[str, bool | str | None]] = {}

    for project in projects:
        projects_checked_count += 1
        if not check_seer_setup_for_project(project):
            results[project.id] = {"success": False, "reason": "missing_seer_setup"}
            continue

        # Check if web vitals detection is enabled in the project's performance issue settings
        performance_settings = get_merged_settings(project.id)
        if not performance_settings.get("web_vitals_detection_enabled", False):
            results[project.id] = {"success": False, "reason": "web_vitals_detection_not_enabled"}
            continue

        detect_web_vitals_issues_for_project.delay(project.id, project.organization.slug)
        results[project.id] = {"success": True}
        projects_dispatched_count += 1

    metrics.incr(
        "web_vitals_issue_detection.projects.checked",
        amount=projects_checked_count,
        sample_rate=1.0,
    )
    metrics.incr(
        "web_vitals_issue_detection.projects.dispatched",
        amount=projects_dispatched_count,
        sample_rate=1.0,
    )

    return results


@instrumented_task(
    name="sentry.tasks.web_vitals_issue_detection.detect_web_vitals_issues_for_project",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def detect_web_vitals_issues_for_project(
    project_id: int, organization_slug: str | None = None
) -> None:
    """
    Process a single project for Web Vitals issue detection.
    """
    if not options.get("issue-detection.web-vitals-detection.enabled"):
        metrics.incr(
            "web_vitals_issue_detection.projects.skipped",
            amount=1,
            tags={
                "reason": "disabled",
                "project_id": project_id,
                "organization": organization_slug,
            },
            sample_rate=1.0,
        )
        return

    web_vital_issue_groups = get_highest_opportunity_page_vitals_for_project(
        project_id, limit=TRANSACTIONS_PER_PROJECT_LIMIT
    )
    sent_counts: dict[WebVitalIssueDetectionGroupingType, int] = defaultdict(int)
    rejected_no_trace_count = 0
    rejected_already_exists_count = 0
    for web_vital_issue_group in web_vital_issue_groups:
        scores = web_vital_issue_group["scores"]
        values = web_vital_issue_group["values"]

        # We can only use a single trace sample for an issue event
        # Use the p75 of the worst performing vital
        vital = sorted(scores.items(), key=lambda item: item[1])[0][0]
        p75_vital_value = values[vital]

        trace = get_trace_by_web_vital_measurement(
            web_vital_issue_group["transaction"],
            project_id,
            vital,
            p75_vital_value,
            start_time_delta=DEFAULT_START_TIME_DELTA,
        )
        if trace:
            sent = send_web_vitals_issue_to_platform(web_vital_issue_group, trace_id=trace.trace_id)
            if sent:
                sent_counts[web_vital_issue_group["vital_grouping"]] += 1
            else:
                rejected_already_exists_count += 1
        else:
            rejected_no_trace_count += 1

    for vital_grouping, count in sent_counts.items():
        metrics.incr(
            "web_vitals_issue_detection.issues.sent",
            amount=count,
            tags={
                "kind": vital_grouping,
                "project_id": project_id,
                "organization": organization_slug,
            },  # rendering, cls, or inp
            sample_rate=1.0,
        )

    metrics.incr(
        "web_vitals_issue_detection.rejected",
        amount=rejected_no_trace_count,
        tags={
            "reason": "no_trace",
            "project_id": project_id,
            "organization": organization_slug,
        },
        sample_rate=1.0,
    )

    metrics.incr(
        "web_vitals_issue_detection.rejected",
        amount=rejected_already_exists_count,
        tags={
            "reason": "already_exists",
            "project_id": project_id,
            "organization": organization_slug,
        },
        sample_rate=1.0,
    )


def get_highest_opportunity_page_vitals_for_project(
    project_id: int, limit: int = 500, start_time_delta: dict[str, int] = DEFAULT_START_TIME_DELTA
) -> list[WebVitalIssueGroupData]:
    """
    Fetches the top opportunity pages for a project and returns a WebVitalIssueGroupData per page per vital
    under the score threshold and with enough samples.

    Top opportunity is calculated as ((1.0 - avg(score)) * count) for each page.
    We only consider the top n pages, where n is set by TRANSACTIONS_PER_PROJECT_LIMIT.
    The score threshold is set by SCORE_THRESHOLD.
    The number of samples is set by SAMPLES_COUNT_THRESHOLD.
    """
    try:
        project = Project.objects.select_related("organization").get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch transactions", extra={"project_id": project_id}
        )
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(**start_time_delta)

    # Get the samples count threshold from performance issue settings
    performance_settings = get_merged_settings(project.id)
    samples_count_threshold = performance_settings.get(
        "web_vitals_count", DEFAULT_SAMPLES_COUNT_THRESHOLD
    )

    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=[project],
        organization=project.organization,
    )
    config = SearchResolverConfig(
        auto_fields=True,
    )

    # Query EAP for highest opportunity pages with web vital scores
    result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"project.id:{project_id}",
        selected_columns=[
            "transaction",
            "opportunity_score(measurements.score.total)",
            "performance_score(measurements.score.lcp)",
            "performance_score(measurements.score.fcp)",
            "performance_score(measurements.score.cls)",
            "performance_score(measurements.score.ttfb)",
            "performance_score(measurements.score.inp)",
            "p75(measurements.lcp)",
            "p75(measurements.fcp)",
            "p75(measurements.cls)",
            "p75(measurements.ttfb)",
            "p75(measurements.inp)",
            "count_scores(measurements.score.lcp)",
            "count_scores(measurements.score.fcp)",
            "count_scores(measurements.score.cls)",
            "count_scores(measurements.score.ttfb)",
            "count_scores(measurements.score.inp)",
        ],
        orderby=["-opportunity_score(measurements.score.total)"],
        offset=0,
        limit=limit,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    web_vital_issue_groups: dict[
        tuple[WebVitalIssueDetectionGroupingType, str], WebVitalIssueGroupData
    ] = {}
    seen_names = set()
    rejected_insufficient_samples_count = 0
    for row in result.get("data", []):
        name = row.get("transaction")
        if not name:
            continue

        normalized_name = normalize_description(name)
        if normalized_name in seen_names:
            continue
        seen_names.add(normalized_name)

        for vital in VITALS:
            score = row.get(f"performance_score(measurements.score.{vital})")
            p75_value = row.get(f"p75(measurements.{vital})")
            samples_count = row.get(f"count_scores(measurements.score.{vital})")
            score_under_threshold = score is not None and score < SCORE_THRESHOLD
            enough_samples = samples_count is not None and samples_count >= samples_count_threshold
            if score is not None and score_under_threshold and p75_value is not None:
                if not enough_samples:
                    rejected_insufficient_samples_count += 1
                    continue
                if (VITAL_GROUPING_MAP[vital], name) not in web_vital_issue_groups:
                    web_vital_issue_groups[(VITAL_GROUPING_MAP[vital], name)] = {
                        "transaction": name,
                        "project": project,
                        "vital_grouping": VITAL_GROUPING_MAP[vital],
                        "scores": {vital: score},
                        "values": {vital: p75_value},
                    }
                else:
                    web_vital_issue_groups[(VITAL_GROUPING_MAP[vital], name)]["scores"][
                        vital
                    ] = score
                    web_vital_issue_groups[(VITAL_GROUPING_MAP[vital], name)]["values"][
                        vital
                    ] = p75_value

    metrics.incr(
        "web_vitals_issue_detection.rejected",
        amount=rejected_insufficient_samples_count,
        tags={
            "reason": "insufficient_samples",
            "project_id": project.id,
            "organization": project.organization.slug,
        },
        sample_rate=1.0,
    )

    return list(web_vital_issue_groups.values())


def check_seer_setup_for_project(project: Project) -> bool:
    """
    Checks if a project and it's organization have the necessary Seer setup to detect web vitals issues.
    The project must have seer feature flags, seer acknowledgement, and a github code mapping.
    """
    if not features.has("organizations:gen-ai-features", project.organization):
        return False

    if project.organization.get_option("sentry:hide_ai_features"):
        return False

    if not get_seer_org_acknowledgement(project.organization):
        return False

    repos = get_autofix_repos_from_project_code_mappings(project)
    github_repos = [repo for repo in repos if repo.get("provider") in SEER_SUPPORTED_SCM_PROVIDERS]
    if not github_repos:
        return False

    return True

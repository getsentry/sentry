from __future__ import annotations
from typing import int

import logging
from datetime import UTC, datetime, timedelta

from sentry import features, options
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
from sentry.web_vitals.issue_platform_adapter import send_web_vitals_issue_to_platform
from sentry.web_vitals.query import get_trace_by_web_vital_measurement
from sentry.web_vitals.types import WebVitalIssueDetectionType, WebVitalIssueGroupData

logger = logging.getLogger("sentry.tasks.web_vitals_issue_detection")

TRANSACTIONS_PER_PROJECT_LIMIT = 5
DEFAULT_START_TIME_DELTA = {"days": 7}  # Low scores within this time range create web vital issues
SCORE_THRESHOLD = 0.9  # Scores below this threshold will create web vital issues
SAMPLES_COUNT_THRESHOLD = 10  # TODO: Use project config threshold setting. Web Vitals require at least this amount of samples to create an issue
VITALS: list[WebVitalIssueDetectionType] = ["lcp", "fcp", "cls", "ttfb", "inp"]


def get_enabled_project_ids() -> list[int]:
    """
    Get the list of project IDs that are explicitly enabled for Web Vitals issue detection.

    Returns the allowlist from system options.
    """
    return options.get("issue-detection.web-vitals-detection.projects-allowlist")


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

    enabled_project_ids = get_enabled_project_ids()
    if not enabled_project_ids:
        return

    # Spawn a sub-task for each project
    projects = Project.objects.filter(id__in=enabled_project_ids).select_related("organization")

    for project in projects:
        if not check_seer_setup_for_project(project):
            continue

        detect_web_vitals_issues_for_project.delay(project.id)


@instrumented_task(
    name="sentry.tasks.web_vitals_issue_detection.detect_web_vitals_issues_for_project",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def detect_web_vitals_issues_for_project(project_id: int) -> None:
    """
    Process a single project for Web Vitals issue detection.
    """
    if not options.get("issue-detection.web-vitals-detection.enabled"):
        return

    web_vital_issue_groups = get_highest_opportunity_page_vitals_for_project(
        project_id, limit=TRANSACTIONS_PER_PROJECT_LIMIT
    )
    for web_vital_issue_group in web_vital_issue_groups:
        p75_vital_value = web_vital_issue_group["value"]
        trace = get_trace_by_web_vital_measurement(
            web_vital_issue_group["transaction"],
            project_id,
            web_vital_issue_group["vital"],
            p75_vital_value,
            start_time_delta=DEFAULT_START_TIME_DELTA,
        )
        if trace:
            send_web_vitals_issue_to_platform(web_vital_issue_group, trace_id=trace.trace_id)


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
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch transactions", extra={"project_id": project_id}
        )
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(**start_time_delta)

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

    web_vital_issue_groups: list[WebVitalIssueGroupData] = []
    seen_names = set()
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
            enough_samples = samples_count is not None and samples_count >= SAMPLES_COUNT_THRESHOLD
            if (
                score is not None
                and score_under_threshold
                and enough_samples
                and p75_value is not None
            ):
                web_vital_issue_groups.append(
                    {
                        "transaction": name,
                        "vital": vital,
                        "score": score,
                        "project": project,
                        "value": p75_value,
                    }
                )

    return web_vital_issue_groups


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

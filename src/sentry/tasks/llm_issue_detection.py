from __future__ import annotations

import logging

import sentry_sdk
from django.conf import settings
from pydantic import BaseModel

from sentry import options
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.explorer.index_data import get_trace_for_transaction, get_transactions_for_project
from sentry.seer.models import SeerApiError
from sentry.seer.sentry_data_models import TraceData
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import json

logger = logging.getLogger("sentry.tasks.llm_issue_detection")

SEER_ANALYZE_ISSUE_ENDPOINT_PATH = "/v1/automation/issue-detection/analyze"
SEER_TIMEOUT_S = 120
SEER_RETRIES = 1


seer_issue_detection_connection_pool = connection_from_url(
    settings.SEER_DEFAULT_URL,
    timeout=SEER_TIMEOUT_S,
    retries=SEER_RETRIES,
    maxsize=10,
)


class DetectedIssue(BaseModel):
    explanation: str
    impact: str
    evidence: str
    missing_telemetry: str | None = None
    title: str


class IssueDetectionResponse(BaseModel):
    issues: list[DetectedIssue]


class LLMIssueDetectionError(SeerApiError):
    def __init__(
        self,
        message: str,
        status: int,
        project_id: int | None = None,
        trace_id: str | None = None,
        response_data: str | None = None,
        error_message: str | None = None,
    ):
        super().__init__(message, status)
        self.project_id = project_id
        self.trace_id = trace_id
        self.response_data = response_data
        self.error_message = error_message


def get_enabled_project_ids() -> list[int]:
    """
    Get the list of project IDs that are explicitly enabled for LLM detection.

    Returns the allowlist from system options.
    """
    return options.get("issue-detection.llm-detection.projects-allowlist")


@instrumented_task(
    name="sentry.tasks.llm_issue_detection.run_llm_issue_detection",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def run_llm_issue_detection() -> None:
    """
    Main scheduled task for LLM issue detection.
    """
    if not options.get("issue-detection.llm-detection.enabled"):
        return

    enabled_project_ids = get_enabled_project_ids()
    if not enabled_project_ids:
        return

    # Spawn a sub-task for each project
    for project_id in enabled_project_ids:
        detect_llm_issues_for_project.delay(project_id)


@instrumented_task(
    name="sentry.tasks.llm_issue_detection.detect_llm_issues_for_project",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def detect_llm_issues_for_project(project_id: int) -> None:
    """
    Process a single project for LLM issue detection.
    """
    project = Project.objects.get_from_cache(id=project_id)
    organization_id = project.organization_id

    transactions = get_transactions_for_project(
        project_id, limit=50, start_time_delta={"minutes": 30}
    )
    for transaction in transactions:
        try:
            trace: TraceData | None = get_trace_for_transaction(
                transaction.name, transaction.project_id
            )
            if not trace:
                continue

            logger.info(
                "Found trace for LLM issue detection",
                extra={
                    "trace_id": trace.trace_id,
                    "project_id": project_id,
                },
            )

            seer_request = {
                "telemetry": [{**trace.dict(), "kind": "trace"}],
                "organization_id": organization_id,
                "project_id": project_id,
            }
            response = make_signed_seer_api_request(
                connection_pool=seer_issue_detection_connection_pool,
                path=SEER_ANALYZE_ISSUE_ENDPOINT_PATH,
                body=json.dumps(seer_request).encode("utf-8"),
            )

            if response.status < 200 or response.status >= 300:
                raise LLMIssueDetectionError(
                    message="Seer HTTP error",
                    status=response.status,
                    project_id=project_id,
                    trace_id=trace.trace_id,
                    response_data=response.data.decode("utf-8"),
                )

            try:
                raw_response_data = response.json()
                response_data = IssueDetectionResponse.parse_obj(raw_response_data)
            except (ValueError, TypeError) as e:
                raise LLMIssueDetectionError(
                    message="Seer response parsing error",
                    status=response.status,
                    project_id=project_id,
                    trace_id=trace.trace_id,
                    response_data=response.data.decode("utf-8"),
                    error_message=str(e),
                )

            n_found_issues = len(response_data.issues)
            logger.info(
                "Seer issue detection success",
                extra={
                    "num_issues": n_found_issues,
                    "trace_id": trace.trace_id,
                    "project_id": project_id,
                    "titles": (
                        [issue.title for issue in response_data.issues]
                        if n_found_issues > 0
                        else None
                    ),
                },
            )
        except LLMIssueDetectionError as e:
            sentry_sdk.capture_exception(e)
            continue

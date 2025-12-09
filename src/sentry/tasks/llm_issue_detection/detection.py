from __future__ import annotations

import logging
import random
from datetime import UTC, datetime
from uuid import uuid4

import sentry_sdk
from django.conf import settings
from pydantic import BaseModel

from sentry import features, options
from sentry.constants import VALID_PLATFORMS
from sentry.issues.grouptype import LLMDetectedExperimentalGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.explorer.index_data import get_transactions_for_project
from sentry.seer.models import SeerApiError
from sentry.seer.sentry_data_models import EvidenceTraceData
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.tasks.base import instrumented_task
from sentry.tasks.llm_issue_detection.trace_data import get_evidence_trace_for_llm_detection
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import json

logger = logging.getLogger("sentry.tasks.llm_issue_detection")

SEER_ANALYZE_ISSUE_ENDPOINT_PATH = "/v1/automation/issue-detection/analyze"
SEER_TIMEOUT_S = 120
SEER_RETRIES = 1

NUM_TRANSACTIONS_TO_PROCESS = 20
LOWER_SPAN_LIMIT = 20
UPPER_SPAN_LIMIT = 500


seer_issue_detection_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
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


def get_base_platform(platform: str | None) -> str | None:
    """
    Extract the base platform from a platform identifier.

    Examples:
        python-flask -> python
        python-django -> python
        javascript-react -> javascript
        python -> python
    """
    if not platform:
        return None

    if platform in VALID_PLATFORMS:
        return platform

    base_platform = platform.split("-")[0]

    if base_platform in VALID_PLATFORMS:
        return base_platform

    return None


def create_issue_occurrence_from_detection(
    detected_issue: DetectedIssue,
    trace: EvidenceTraceData,
    project_id: int,
    transaction_name: str,
) -> None:
    """
    Create and produce an IssueOccurrence from an LLM-detected issue.
    """
    event_id = uuid4().hex
    occurrence_id = uuid4().hex
    detection_time = datetime.now(UTC)
    project = Project.objects.get_from_cache(id=project_id)
    title = detected_issue.title.lower().replace(" ", "-")
    fingerprint = [f"llm-detected-{title}-{transaction_name}"]

    evidence_data = {
        "trace_id": trace.trace_id,
        "transaction": transaction_name,
        "explanation": detected_issue.explanation,
        "impact": detected_issue.impact,
        "evidence": detected_issue.evidence,
        "missing_telemetry": detected_issue.missing_telemetry,
    }

    evidence_display = [
        IssueEvidence(name="Explanation", value=detected_issue.explanation, important=True),
        IssueEvidence(name="Impact", value=detected_issue.impact, important=False),
        IssueEvidence(name="Evidence", value=detected_issue.evidence, important=False),
    ]

    occurrence = IssueOccurrence(
        id=occurrence_id,
        event_id=event_id,
        project_id=project_id,
        fingerprint=fingerprint,
        issue_title=detected_issue.title,
        subtitle=detected_issue.explanation[:200],  # Truncate for subtitle
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=LLMDetectedExperimentalGroupType,
        detection_time=detection_time,
        culprit=transaction_name,
        level="warning",
    )

    platform = get_base_platform(project.platform) or "other"

    event_data = {
        "event_id": event_id,
        "project_id": project_id,
        "platform": platform,
        "received": detection_time.isoformat(),
        "timestamp": detection_time.isoformat(),
        "transaction": transaction_name,
        "contexts": {
            "trace": {
                "trace_id": trace.trace_id,
                "type": "trace",
            }
        },
    }

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )


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
    processing_deadline_duration=300,
)
def detect_llm_issues_for_project(project_id: int) -> None:
    """
    Process a single project for LLM issue detection.
    """
    project = Project.objects.get_from_cache(id=project_id)
    organization = project.organization
    organization_id = organization.id

    has_access = features.has("organizations:gen-ai-features", organization) and not bool(
        organization.get_option("sentry:hide_ai_features")
    )
    if not has_access:
        return

    transactions = get_transactions_for_project(
        project_id, limit=100, start_time_delta={"minutes": 30}
    )
    if not transactions:
        return

    # Shuffle transactions to randomize order
    random.shuffle(transactions)

    processed_count = 0
    for transaction in transactions:
        if processed_count >= NUM_TRANSACTIONS_TO_PROCESS:
            break

        try:
            trace = get_evidence_trace_for_llm_detection(transaction.name, transaction.project_id)

            if (
                not trace
                or trace.total_spans < LOWER_SPAN_LIMIT
                or trace.total_spans > UPPER_SPAN_LIMIT
            ):
                continue

            processed_count += 1
            logger.info(
                "Found trace for LLM issue detection",
                extra={
                    "trace_id": trace.trace_id,
                    "project_id": project_id,
                    "total_spans": trace.total_spans,
                    "transaction_name": trace.transaction_name,
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
            for detected_issue in response_data.issues:
                try:
                    create_issue_occurrence_from_detection(
                        detected_issue=detected_issue,
                        trace=trace,
                        project_id=project_id,
                        transaction_name=transaction.name,
                    )

                except Exception as e:
                    sentry_sdk.capture_exception(e)
        except LLMIssueDetectionError as e:
            sentry_sdk.capture_exception(e)
            continue  # if one transaction encounters an error, don't block processing of the others

from __future__ import annotations

import logging
import random
from datetime import UTC, datetime
from uuid import uuid4

from django.conf import settings
from pydantic import BaseModel, ValidationError
from urllib3 import Retry

from sentry import features, options
from sentry.constants import VALID_PLATFORMS
from sentry.issues.grouptype import LLMDetectedExperimentalGroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.sentry_data_models import TraceMetadata
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.tasks.base import instrumented_task
from sentry.tasks.llm_issue_detection.trace_data import (
    get_project_top_transaction_traces_for_llm_detection,
)
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import json

logger = logging.getLogger("sentry.tasks.llm_issue_detection")

SEER_ANALYZE_ISSUE_ENDPOINT_PATH = "/v1/automation/issue-detection/analyze"
SEER_TIMEOUT_S = 180
SEER_RETRIES = Retry(total=1, backoff_factor=2, status_forcelist=[408, 429, 502, 503, 504])
START_TIME_DELTA_MINUTES = 30
TRANSACTION_BATCH_SIZE = 100
NUM_TRANSACTIONS_TO_PROCESS = 20


seer_issue_detection_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
    timeout=SEER_TIMEOUT_S,
    retries=SEER_RETRIES,
    maxsize=10,
)


class DetectedIssue(BaseModel):
    # LLM generated fields
    explanation: str
    impact: str
    evidence: str
    missing_telemetry: str | None = None
    offender_span_ids: list[str]
    title: str
    subcategory: str
    category: str
    verification_reason: str | None = None


class DetectedIssueResponse(DetectedIssue):
    # context fields, not LLM generated
    trace_id: str
    transaction_name: str


class IssueDetectionResponse(BaseModel):
    issues: list[DetectedIssueResponse]
    traces_analyzed: int


class IssueDetectionRequest(BaseModel):
    traces: list[TraceMetadata]
    organization_id: int
    project_id: int


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
    detected_issue: DetectedIssueResponse,
    project_id: int,
) -> None:
    """
    Create and produce an IssueOccurrence from an LLM-detected issue.
    """
    event_id = uuid4().hex
    occurrence_id = uuid4().hex
    detection_time = datetime.now(UTC)
    project = Project.objects.get_from_cache(id=project_id)
    trace_id = detected_issue.trace_id
    transaction_name = detected_issue.transaction_name
    title = detected_issue.title.lower().replace(" ", "-")
    fingerprint = [f"llm-detected-{title}-{transaction_name}"]

    evidence_data = {
        "trace_id": trace_id,
        "transaction": transaction_name,
        "explanation": detected_issue.explanation,
        "impact": detected_issue.impact,
        "evidence": detected_issue.evidence,
        "missing_telemetry": detected_issue.missing_telemetry,
        "offender_span_ids": detected_issue.offender_span_ids,
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
                "trace_id": trace_id,
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

    # Spawn a sub-task for each project with staggered delays
    for index, project_id in enumerate(enabled_project_ids):
        detect_llm_issues_for_project.apply_async(
            args=[project_id],
            countdown=index * 120,
        )


@instrumented_task(
    name="sentry.tasks.llm_issue_detection.detect_llm_issues_for_project",
    namespace=issues_tasks,
    processing_deadline_duration=10 * 60,
)
def detect_llm_issues_for_project(project_id: int) -> None:
    """
    Process a single project for LLM issue detection.

    Gets the project's top TRANSACTION_BATCH_SIZE transaction spans from the last START_TIME_DELTA_MINUTES, sorted by -sum(span.duration).
    From those transactions, dedupes on normalized transaction_name.
    For each deduped transaction, gets first trace_id from the start of time window, which has small random variation.
    Sends these trace_ids to seer, which uses get_trace_waterfall to construct an EAPTrace to analyze.
    """
    project = Project.objects.get_from_cache(id=project_id)
    organization = project.organization
    organization_id = organization.id

    has_access = features.has("organizations:gen-ai-features", organization) and not bool(
        organization.get_option("sentry:hide_ai_features")
    )
    if not has_access:
        return

    evidence_traces = get_project_top_transaction_traces_for_llm_detection(
        project_id, limit=TRANSACTION_BATCH_SIZE, start_time_delta_minutes=START_TIME_DELTA_MINUTES
    )
    if not evidence_traces:
        return

    logger.info(
        "Getting traces for detection",
        extra={
            "organization_id": organization_id,
            "project_id": project_id,
            "num_traces": len(evidence_traces),
            "num_unique_traces": len({trace.trace_id for trace in evidence_traces}),
        },
    )
    # Shuffle to randomize order
    random.shuffle(evidence_traces)
    processed_traces = 0

    for trace in evidence_traces:
        if processed_traces >= NUM_TRANSACTIONS_TO_PROCESS:
            break

        logger.info(
            "Sending Seer Request for Detection",
            extra={
                "trace_id": trace.trace_id,
                "transaction_name": trace.transaction_name,
                "organization_id": organization_id,
                "project_id": project_id,
            },
        )
        seer_request = IssueDetectionRequest(
            traces=[trace],
            organization_id=organization_id,
            project_id=project_id,
        )

        try:
            response = make_signed_seer_api_request(
                connection_pool=seer_issue_detection_connection_pool,
                path=SEER_ANALYZE_ISSUE_ENDPOINT_PATH,
                body=json.dumps(seer_request.dict()).encode("utf-8"),
            )
        except Exception:
            logger.exception(
                "Seer network error",
                extra={
                    "project_id": project_id,
                    "organization_id": organization_id,
                    "trace_id": trace.trace_id,
                },
            )
            continue

        if response.status < 200 or response.status >= 300:
            logger.error(
                "Seer HTTP error",
                extra={
                    "project_id": project_id,
                    "organization_id": organization_id,
                    "status": response.status,
                    "response_data": response.data.decode("utf-8"),
                    "trace_id": trace.trace_id,
                },
            )
            continue

        try:
            raw_response_data = response.json()
            # Add debug logging to see raw response
            logger.info(
                "Raw Seer response",
                extra={
                    "raw_issues_count": len(raw_response_data.get("issues", [])),
                    "raw_traces_analyzed": raw_response_data.get("traces_analyzed", 0),
                    "trace_id": trace.trace_id,
                    "response_keys": (
                        list(raw_response_data.keys())
                        if isinstance(raw_response_data, dict)
                        else None
                    ),
                },
            )
            response_data = IssueDetectionResponse.parse_obj(raw_response_data)
        except (ValueError, TypeError, ValidationError) as e:
            logger.exception(
                "Seer response parsing error",
                extra={
                    "project_id": project_id,
                    "organization_id": organization_id,
                    "status": response.status,
                    "response_data": response.data.decode("utf-8"),
                    "trace_id": trace.trace_id,
                    "error_detail": str(e),
                },
            )
            continue

        n_found_issues = len(response_data.issues)
        num_traces_analyzed = response_data.traces_analyzed
        processed_traces += response_data.traces_analyzed
        if num_traces_analyzed > 0:
            logger.info(
                "Seer issue detection success",
                extra={
                    "num_traces": 1,
                    "num_issues": n_found_issues,
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "titles": (
                        [issue.title for issue in response_data.issues]
                        if n_found_issues > 0
                        else None
                    ),
                    "trace_id": trace.trace_id,
                    "traces_analyzed": num_traces_analyzed,
                },
            )
        for detected_issue in response_data.issues:
            try:
                create_issue_occurrence_from_detection(
                    detected_issue=detected_issue,
                    project_id=project_id,
                )
                logger.info(
                    "LLM Issue Detection Category",
                    extra={
                        "category": detected_issue.category,
                        "subcategory": detected_issue.subcategory,
                        "verification_reason": detected_issue.verification_reason,
                        "trace_id": trace.trace_id,
                    },
                )
            except Exception:
                logger.exception(
                    "Error creating issue occurrence",
                    extra={
                        "project_id": project_id,
                        "organization_id": organization_id,
                        "issue_title": detected_issue.title,
                        "trace_id": trace.trace_id,
                    },
                )
                continue

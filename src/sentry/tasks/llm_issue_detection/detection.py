from __future__ import annotations

import logging
import random
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import orjson
import sentry_sdk
from django.conf import settings
from django.db.models import F
from pydantic import BaseModel, Field
from urllib3 import BaseHTTPResponse

from sentry import features, options
from sentry.constants import VALID_PLATFORMS, ObjectStatus
from sentry.issues.grouptype import (
    AIDetectedCodeHealthGroupType,
    AIDetectedDBGroupType,
    AIDetectedGeneralGroupType,
    AIDetectedHTTPGroupType,
    AIDetectedRuntimePerformanceGroupType,
    AIDetectedSecurityGroupType,
    GroupType,
)
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.seer.explorer.utils import normalize_description
from sentry.seer.signed_seer_api import SeerViewerContext, make_signed_seer_api_request
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import json
from sentry.utils.cursored_scheduler import CursoredScheduler
from sentry.utils.redis import redis_clusters

logger = logging.getLogger("sentry.tasks.llm_issue_detection")

SEER_ANALYZE_ISSUE_ENDPOINT_PATH = "/v1/automation/issue-detection/analyze"
SEER_CHECK_BUDGET_ENDPOINT_PATH = "/v1/automation/issue-detection/check-budget"
SEER_TIMEOUT_S = 10
START_TIME_DELTA_MINUTES = 60
TRANSACTION_BATCH_SIZE = 50
TRACE_PROCESSING_TTL_SECONDS = 7200
MAX_LLM_FIELD_LENGTH = 2000

DETECTION_CYCLE_DURATION = timedelta(hours=1)


seer_issue_detection_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL,
    timeout=SEER_TIMEOUT_S,
    retries=0,
    maxsize=10,
)


def _get_unprocessed_traces(trace_ids: list[str]) -> set[str]:
    """Return set of trace_ids that have NOT been processed"""
    if not trace_ids:
        return set()
    cluster = redis_clusters.get("default")
    keys = [f"llm_detection:processed:{tid}" for tid in trace_ids]
    results = cluster.mget(keys)
    return {tid for tid, val in zip(trace_ids, results) if val is None}


def mark_traces_as_processed(trace_ids: list[str]) -> None:
    """
    Mark traces as processed for LLM issue detection to prevent duplicate analysis.

    Will overwrite existing keys to refresh the TTL, since reaching this point
    means we have confirmation that the trace is being processed.
    """
    if not trace_ids:
        return

    cluster = redis_clusters.get("default")
    with cluster.pipeline() as pipeline:
        for trace_id in trace_ids:
            key = f"llm_detection:processed:{trace_id}"
            pipeline.set(key, "1", ex=TRACE_PROCESSING_TTL_SECONDS)
        pipeline.execute()


class DetectedIssue(BaseModel):
    # LLM generated fields
    title: str = Field(..., max_length=MAX_LLM_FIELD_LENGTH)
    explanation: str = Field(..., max_length=MAX_LLM_FIELD_LENGTH)
    impact: str = Field(..., max_length=MAX_LLM_FIELD_LENGTH)
    evidence: str = Field(..., max_length=MAX_LLM_FIELD_LENGTH)
    offender_span_ids: list[str]
    transaction_name: str = Field(..., max_length=MAX_LLM_FIELD_LENGTH)
    verification_reason: str = Field(..., max_length=MAX_LLM_FIELD_LENGTH)
    group_for_fingerprint: str = Field(..., max_length=MAX_LLM_FIELD_LENGTH)
    project_id: int | None = None
    # context field, not LLM generated
    trace_id: str


class TraceMetadataWithSpanCount(BaseModel):
    trace_id: str
    span_count: int


class IssueDetectionRequest(BaseModel):
    traces: list[TraceMetadataWithSpanCount]
    organization_id: int
    project_id: int
    org_slug: str


def make_issue_detection_request(
    request: IssueDetectionRequest,
    timeout: int | float | None = None,
    retries: int | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    extra_kwargs: dict[str, Any] = {}
    if timeout is not None:
        extra_kwargs["timeout"] = timeout
    if retries is not None:
        extra_kwargs["retries"] = retries
    return make_signed_seer_api_request(
        seer_issue_detection_connection_pool,
        SEER_ANALYZE_ISSUE_ENDPOINT_PATH,
        body=orjson.dumps(request.dict()),
        viewer_context=viewer_context,
        **extra_kwargs,
    )


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


TITLE_TO_GROUP_TYPE: dict[str, type[GroupType]] = {
    "Inefficient HTTP Requests": AIDetectedHTTPGroupType,
    "Degraded HTTP Operation": AIDetectedHTTPGroupType,
    "Failed HTTP Operation": AIDetectedHTTPGroupType,
    "Inefficient Database Queries": AIDetectedDBGroupType,
    "Degraded Database Operation": AIDetectedDBGroupType,
    "Main Thread Blocking Operation": AIDetectedRuntimePerformanceGroupType,
    "Degraded UI Performance": AIDetectedRuntimePerformanceGroupType,
    "Potential Security Leak": AIDetectedSecurityGroupType,
    "Potential Security Risk": AIDetectedSecurityGroupType,
    "Configuration Warning": AIDetectedCodeHealthGroupType,
    "Deprecation Warning": AIDetectedCodeHealthGroupType,
}

GROUP_TYPE_TO_SETTING: dict[type[GroupType], str] = {
    AIDetectedHTTPGroupType: "ai_detected_http_enabled",
    AIDetectedDBGroupType: "ai_detected_db_enabled",
    AIDetectedRuntimePerformanceGroupType: "ai_detected_runtime_performance_enabled",
    AIDetectedSecurityGroupType: "ai_detected_security_enabled",
    AIDetectedCodeHealthGroupType: "ai_detected_code_health_enabled",
    AIDetectedGeneralGroupType: "ai_detected_general_enabled",
}


FALLBACK_ISSUE_TITLE = "AI-Detected Application Issue"


def get_group_type_for_title(title: str) -> type[GroupType]:
    return TITLE_TO_GROUP_TYPE.get(title, AIDetectedGeneralGroupType)


def create_issue_occurrence_from_detection(
    detected_issue: DetectedIssue,
    project: Project,
) -> None:
    """
    Create and produce an IssueOccurrence from an LLM-detected issue.
    """
    group_type = get_group_type_for_title(detected_issue.title)
    setting_key = GROUP_TYPE_TO_SETTING.get(group_type)
    if setting_key:
        perf_settings = project.get_option("sentry:performance_issue_settings", default={})
        if not perf_settings.get(setting_key, True):
            return

    event_id = uuid4().hex
    occurrence_id = uuid4().hex
    detection_time = datetime.now(UTC)
    trace_id = detected_issue.trace_id
    transaction_name = normalize_description(detected_issue.transaction_name)
    transaction_slug = transaction_name.strip().lower().replace(" ", "-")

    fingerprint = [f"1-{group_type.type_id}-{transaction_slug}"]

    evidence_data = {
        "trace_id": trace_id,
        "transaction": transaction_name,
        "explanation": detected_issue.explanation,
        "impact": detected_issue.impact,
        "evidence": detected_issue.evidence,
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
        project_id=project.id,
        fingerprint=fingerprint,
        issue_title=(
            FALLBACK_ISSUE_TITLE if detected_issue.title == "Other" else detected_issue.title
        ),
        subtitle=detected_issue.explanation[:200],  # Truncate for subtitle
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=get_group_type_for_title(detected_issue.title),
        detection_time=detection_time,
        culprit=transaction_name,
        level="warning",
    )

    platform = get_base_platform(project.platform) or "other"

    event_data = {
        "event_id": event_id,
        "project_id": project.id,
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


def _is_org_eligible(org_id: int) -> bool:
    try:
        org = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        return False
    return (
        features.has("organizations:ai-issue-detection", org)
        and features.has("organizations:gen-ai-features", org)
        and not org.get_option("sentry:hide_ai_features")
    )


@instrumented_task(
    name="sentry.tasks.llm_issue_detection.run_llm_issue_detection",
    namespace=issues_tasks,
    processing_deadline_duration=300,  # 5 minutes
)
def run_llm_issue_detection() -> None:
    """
    Main scheduled task for LLM issue detection.

    Uses CursoredScheduler to iterate all active orgs in batches over a cycle.
    Orgs are filtered by feature flags via validate_item before dispatching.
    """
    if not options.get("issue-detection.llm-detection.enabled"):
        return

    scheduler = CursoredScheduler(
        name="llm_issue_detection",
        schedule_key="llm-issue-detection",
        queryset=Organization.objects.filter(
            status=OrganizationStatus.ACTIVE,
            flags=F("flags").bitor(Organization.flags.early_adopter),
        ),
        task=detect_llm_issues_for_org,
        cycle_duration=DETECTION_CYCLE_DURATION,
        validate_item=_is_org_eligible,
    )
    scheduler.tick()


@instrumented_task(
    name="sentry.tasks.llm_issue_detection.detect_llm_issues_for_org",
    namespace=issues_tasks,
    processing_deadline_duration=180,  # 3 minutes
)
def detect_llm_issues_for_org(org_id: int) -> None:
    """
    Process a single organization for LLM issue detection.

    Picks one random active project, selects 1 trace, and sends to Seer.
    Budget enforcement happens on the Seer side.
    """
    from sentry.tasks.llm_issue_detection.trace_data import (  # circular imports
        get_next_project_id,
        get_project_top_transaction_traces_for_llm_detection,
    )

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        return

    project_ids = list(
        Project.objects.filter(
            organization_id=org_id,
            status=ObjectStatus.ACTIVE,
        ).values_list("id", flat=True)
    )
    if not project_ids:
        return

    project_id = get_next_project_id(organization, project_ids)
    if not project_id:
        return

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        return
    perf_settings = project.get_option("sentry:performance_issue_settings", default={})
    if not perf_settings.get("ai_issue_detection_enabled", True):
        return

    budget_response = make_signed_seer_api_request(
        seer_issue_detection_connection_pool,
        f"{SEER_CHECK_BUDGET_ENDPOINT_PATH}/{org_id}",
        body=b"",
        method="GET",
        timeout=SEER_TIMEOUT_S,
    )
    if budget_response.status == 200:
        # fail-open since there is an additional budget check on the seer side
        try:
            body = json.loads(budget_response.data)
            if not body.get("has_budget", True):
                logger.info(
                    "llm_issue_detection.budget_exceeded",
                    extra={"organization_id": org_id},
                )
                return
        except json.JSONDecodeError:
            pass

    evidence_traces = get_project_top_transaction_traces_for_llm_detection(
        project_id, limit=TRANSACTION_BATCH_SIZE, start_time_delta_minutes=START_TIME_DELTA_MINUTES
    )
    if not evidence_traces:
        return

    random.shuffle(evidence_traces)

    all_trace_ids = [t.trace_id for t in evidence_traces]
    unprocessed_ids = _get_unprocessed_traces(all_trace_ids)
    skipped = len(all_trace_ids) - len(unprocessed_ids)
    if skipped:
        sentry_sdk.metrics.count("llm_issue_detection.trace.skipped", skipped)

    traces_to_send: list[TraceMetadataWithSpanCount] = [
        t for t in evidence_traces if t.trace_id in unprocessed_ids
    ][:1]

    if not traces_to_send:
        return

    sentry_sdk.metrics.count(
        "llm_issue_detection.seer_request",
        1,
        attributes={"trace_count": len(traces_to_send)},
    )

    seer_request = IssueDetectionRequest(
        traces=traces_to_send,
        organization_id=org_id,
        project_id=project_id,
        org_slug=organization.slug,
    )

    viewer_context = SeerViewerContext(organization_id=org_id)
    response = make_issue_detection_request(
        seer_request,
        timeout=SEER_TIMEOUT_S,
        retries=0,
        viewer_context=viewer_context,
    )

    if response.status == 202:
        mark_traces_as_processed([trace.trace_id for trace in traces_to_send])
        return

    logger.error(
        "llm_issue_detection.unexpected_response",
        extra={
            "status_code": response.status,
            "response_data": response.data,
            "project_id": project_id,
            "organization_id": org_id,
        },
    )

import logging
import textwrap
from enum import StrEnum

from pydantic import BaseModel, Field

from sentry import options
from sentry.autopilot.tasks.common import AutopilotDetectorName, create_instrumentation_issue
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.tools import get_trace_waterfall
from sentry.seer.models import SeerPermissionError
from sentry.tasks.base import instrumented_task
from sentry.tasks.llm_issue_detection.detection import TraceMetadataWithSpanCount
from sentry.tasks.llm_issue_detection.trace_data import (
    get_project_top_transaction_traces_for_llm_detection,
)
from sentry.taskworker.namespaces import autopilot_tasks
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class TraceInstrumentationFinishReason(StrEnum):
    SUCCESS = "success"
    ANALYSIS_ERROR = "analysis_error"


class InstrumentationIssueCategory(StrEnum):
    """
    Known instrumentation issue categories.
    LLM may return custom categories not defined here.
    """

    MISSING_INSTRUMENTATION = "missing_instrumentation"


class TraceInstrumentationIssue(BaseModel):
    """Schema for a trace instrumentation issue identified by Seer."""

    explanation: str = Field(..., max_length=2000)
    impact: str = Field(..., max_length=2000)
    evidence: str = Field(..., max_length=2000)
    offender_span_ids: list[str] = Field(default_factory=list, max_length=10)
    missing_telemetry: str | None = Field(None, max_length=2000)
    title: str = Field(..., max_length=200)
    category: str = Field(..., max_length=100)
    subcategory: str = Field(..., max_length=200)


class TraceInstrumentationResult(BaseModel):
    """Result schema for trace instrumentation detection."""

    issues: list[TraceInstrumentationIssue]
    finish_reason: str


def _build_instrumentation_prompt(trace_json: str, project_slug: str) -> str:
    """Build the prompt for trace instrumentation analysis.

    Args:
        trace_json: Pre-serialized JSON string of the trace data.
        project_slug: The project slug for context.
    """
    return textwrap.dedent(
        f"""\
        You analyze trace telemetry to identify instrumentation issues. Your default answer is: no issues exist.

        ### CONTEXT
        This is ONE trace from project {project_slug}. Most traces will have adequate instrumentation.
        Finding an issue should be the exception, not the rule.
        Focus on issues that would provide meaningful debugging value, not minor optimizations.
        A developer will investigate any issue you report. False positives waste their time and should never be reported.

        ### TELEMETRY
        ```
        {trace_json}
        ```

        ### DETECTION CRITERIA
        Your job is to identify genuine instrumentation issues that reduce debugging effectiveness or add unnecessary noise.
        Only report issues that are:
        - **Significant**: Would materially improve debugging, performance analysis, or observability
        - **Concrete**: Backed by specific evidence from the trace (span IDs, patterns, anomalies)
        - **Actionable**: You can describe what instrumentation change to make
        - **Fixable**: Issue can be resolved by modifying instrumentation in this service

        ### TYPES OF INSTRUMENTATION ISSUES TO DETECT:

        1. **Missing Spans**:
           - Database operations without `db.*` spans
           - HTTP requests without `http.*` or `request.*` spans
           - Cache operations without `cache.*` spans
           - Message queue operations without `messaging.*` spans
           - Orphaned spans (parent_span_id references non-existent span)
           - Large time gaps between child spans suggesting uninstrumented work

        2. **Other Issues** (identify if you observe them):
           - Any other instrumentation problem that reduces observability
           - Use your judgment to categorize and describe

        ### MANDATORY REJECTION — Do NOT report if ANY apply:
        1. **Speculative**: Based on assumptions rather than concrete trace evidence
        2. **Minor**: Issue would provide minimal debugging value
        3. **Unproven**: Cannot cite specific span IDs or patterns proving the issue
        4. **Unfixable**: Cannot describe what instrumentation change to make
        5. **Expected**: Normal trace characteristics for this platform or SDK version
        6. **Downstream**: Issue is in external services or dependencies (not fixable in this codebase)

        ### BEFORE REPORTING
        For each issue you intend to report, verify it does not match ANY mandatory rejection criteria. If it does, discard it.

        ### OUTPUT FORMAT
        For each issue provide:
        - **explanation**: Detailed analysis of the issue (max 40 words)
        - **impact**: How this affects debugging/observability with specifics (max 25 words)
        - **evidence**: Cite specific span IDs, patterns, or anomalies proving the issue (max 30 words)
        - **offender_span_ids**: List the specific span IDs demonstrating the issue (max 10)
        - **missing_telemetry**: Description of what instrumentation should be added (max 20 words). Applicable for missing span issues.
        - **title**: Canonical issue category (max 10 words)
        - **category**: Short snake_case identifier for the issue type (max 5 words). Use `"{InstrumentationIssueCategory.MISSING_INSTRUMENTATION}"` for missing span issues. For other issue types, create a descriptive snake_case category (e.g., "span_quality", "context_propagation").
        - **subcategory**: Human-readable description of the specific pattern (max 5 words). Examples: "Missing Database Spans", "Generic Descriptions", "Orphaned Spans"

        ### TITLE GUIDELINES
        Return a canonical title representing the issue pattern, not the specific instance.
        Title = Issue Type, optionally with Operation Category if meaningful.
        Strip away: counts, locations, business context.
        Two issues with the same root cause must return identical titles.

        **Examples:**
        - "Database calls not instrumented", "DB queries missing spans" → "Missing Database Instrumentation"
        - "HTTP requests without spans", "External API calls not tracked" → "Missing HTTP Instrumentation"
        - "Orphaned span in checkout flow", "Parent span not found" → "Orphaned Spans"

        ### CATEGORY GUIDELINES
        **category**: Short snake_case identifier for the issue type.
        Use `"{InstrumentationIssueCategory.MISSING_INSTRUMENTATION}"` for missing span issues.
        For other issue types, create a descriptive snake_case category (e.g., "span_quality", "context_propagation").

        **subcategory**: More specific pattern within the category (e.g., "missing_database_spans", "generic_descriptions").

        ### FINISH REASON
        Return one of:
        - "{TraceInstrumentationFinishReason.SUCCESS}": Analysis completed successfully (use this whether issues were found or not)
        - "{TraceInstrumentationFinishReason.ANALYSIS_ERROR}": Cannot analyze due to invalid or malformed trace data

        Always return "{TraceInstrumentationFinishReason.SUCCESS}" when you complete analysis, with issues as an empty list if no issues were found.
        """
    )


def sample_trace_for_instrumentation_analysis(
    project: Project,
) -> TraceMetadataWithSpanCount | None:
    """
    Sample ONE trace for instrumentation analysis.
    Uses top transaction sampling with random time offset.
    Returns the top transaction's first trace with valid span count (20-500).
    """
    traces = get_project_top_transaction_traces_for_llm_detection(
        project_id=project.id,
        limit=1,  # Only need 1 trace
        start_time_delta_minutes=24 * 60,  # 24 hours
    )
    return traces[0] if traces else None


@instrumented_task(
    name="sentry.autopilot.tasks.run_trace_instrumentation_detector",
    namespace=autopilot_tasks,
    processing_deadline_duration=60,
)
def run_trace_instrumentation_detector() -> None:
    """Main scheduled task that coordinates trace instrumentation detection across organizations."""
    organization_allowlist = options.get("autopilot.organization-allowlist")
    if not organization_allowlist:
        return

    organizations = Organization.objects.filter(slug__in=organization_allowlist)

    for organization in organizations:
        run_trace_instrumentation_detector_for_organization(organization)


def run_trace_instrumentation_detector_for_organization(organization: Organization) -> None:
    """Queue per-project trace instrumentation detection tasks for active projects."""
    projects = Project.objects.filter(
        organization=organization,
        status=ObjectStatus.ACTIVE,
    )

    for project in projects:
        run_trace_instrumentation_detector_for_project_task.apply_async(
            args=(organization.id, project.id),
            headers={"sentry-propagate-traces": False},
        )


@instrumented_task(
    name="sentry.autopilot.tasks.run_trace_instrumentation_detector_for_project_task",
    namespace=autopilot_tasks,
    processing_deadline_duration=300,
)
def run_trace_instrumentation_detector_for_project_task(
    organization_id: int, project_id: int
) -> list[TraceInstrumentationIssue] | None:
    """
    Analyze ONE trace from a project to identify instrumentation issues using SeerExplorerClient.

    Returns:
        List of instrumentation issues found, or None if detection failed.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
        project = Project.objects.get(id=project_id, status=ObjectStatus.ACTIVE)
    except (Organization.DoesNotExist, Project.DoesNotExist):
        return None

    trace_metadata = sample_trace_for_instrumentation_analysis(project)
    if not trace_metadata:
        return None

    trace_id = trace_metadata.trace_id

    try:
        eap_trace = get_trace_waterfall(trace_id=trace_id, organization_id=organization.id)
    except Exception:
        logger.exception(
            "trace_instrumentation_detector.trace_query_failed",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "trace_id": trace_id,
            },
        )
        return None

    if not eap_trace or not eap_trace.trace:
        logger.warning(
            "trace_instrumentation_detector.empty_trace_data",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "trace_id": trace_id,
            },
        )
        return None

    try:
        client = SeerExplorerClient(
            organization,
            user=None,
            category_key=AutopilotDetectorName.TRACE_INSTRUMENTATION,
            category_value=str(trace_id),
            intelligence_level="medium",
        )
    except SeerPermissionError:
        logger.warning(
            "trace_instrumentation_detector.no_seer_access",
            extra={"organization_id": organization.id, "project_id": project.id},
        )
        return None

    # Check trace size to avoid exceeding LLM context limits
    trace_json = json.dumps(eap_trace.trace)
    if len(trace_json) > 100_000:
        logger.warning(
            "trace_instrumentation_detector.trace_too_large",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "trace_id": trace_id,
                "trace_size_bytes": len(trace_json),
            },
        )
        return None

    prompt = _build_instrumentation_prompt(trace_json, project.slug)

    try:
        with metrics.timer(
            "autopilot.trace_instrumentation_detector.run_duration",
            tags={"project_slug": project.slug},
            sample_rate=1.0,
        ):
            run_id = client.start_run(
                prompt,
                artifact_key="issues",
                artifact_schema=TraceInstrumentationResult,
            )
            state = client.get_run(run_id, blocking=True, poll_timeout=240.0, poll_interval=5.0)

        result = state.get_artifact("issues", TraceInstrumentationResult)
        if result is None:
            logger.warning(
                "trace_instrumentation_detector.no_artifact_result",
                extra={
                    "organization_id": organization.id,
                    "project_id": project.id,
                    "trace_id": trace_id,
                    "run_id": run_id,
                },
            )
            return None

        issues = result.issues
        finish_reason = result.finish_reason

        logger.warning(
            "trace_instrumentation_detector.analysis_complete",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "project_slug": project.slug,
                "trace_id": trace_id,
                "transaction_name": trace_metadata.transaction_name,
                "run_id": run_id,
                "finish_reason": finish_reason,
                "issue_count": len(issues),
                "issue_categories": [issue.category for issue in issues],
            },
        )

        if finish_reason == TraceInstrumentationFinishReason.SUCCESS:
            seen_titles: set[str] = set()
            for issue in issues:
                # Dedupe by title to avoid creating redundant issues
                if issue.title in seen_titles:
                    continue
                seen_titles.add(issue.title)

                create_instrumentation_issue(
                    project_id=project.id,
                    detector_name=AutopilotDetectorName.TRACE_INSTRUMENTATION,
                    title=issue.title,
                    subtitle=issue.subcategory,
                    description=f"{issue.explanation}\n\n"
                    f"**Impact**: {issue.impact}\n\n"
                    f"**Evidence**: {issue.evidence}\n\n"
                    f"**Missing Telemetry**: {issue.missing_telemetry or 'Not specified'}\n\n"
                    f"**Affected Spans**: {', '.join(issue.offender_span_ids)}",
                )

        return issues

    except Exception:
        logger.exception(
            "autopilot.trace_instrumentation_detector.error",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "project_slug": project.slug,
                "trace_id": trace_id,
            },
        )
        return None

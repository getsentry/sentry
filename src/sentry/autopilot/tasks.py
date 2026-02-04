import logging
import textwrap
import uuid
from datetime import timedelta
from enum import StrEnum
from itertools import chain, groupby
from typing import Any

from django.db.models import Q
from django.utils import timezone
from packaging import version
from pydantic import BaseModel, Field

from sentry import options
from sentry.api.utils import handle_query_errors
from sentry.autopilot.grouptype import InstrumentationIssueExperimentalGroupType
from sentry.constants import INTEGRATION_ID_TO_PLATFORM_DATA, ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sdk_updates import get_sdk_versions
from sentry.search.events.types import SnubaParams
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.tools import get_trace_waterfall
from sentry.seer.models import SeerPermissionError
from sentry.seer.sentry_data_models import TraceMetadata
from sentry.snuba import discover
from sentry.tasks.base import instrumented_task
from sentry.tasks.llm_issue_detection.trace_data import (
    get_project_top_transaction_traces_for_llm_detection,
)
from sentry.taskworker.namespaces import autopilot_tasks
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


class SupportedPlatformPrefix(StrEnum):
    JAVASCRIPT = "javascript"
    NODE = "node"
    PYTHON = "python"


class AutopilotDetectorName(StrEnum):
    SDK_UPDATE = "sdk-update"
    MISSING_SDK_INTEGRATION = "missing-sdk-integration"
    TRACE_INSTRUMENTATION = "trace-instrumentation"


class MissingSdkIntegrationFinishReason(StrEnum):
    SUCCESS = "success"
    MISSING_SENTRY_INIT = "missing_sentry_init"
    MISSING_DEPENDENCY_FILE = "missing_dependency_file"


class TraceInstrumentationFinishReason(StrEnum):
    SUCCESS = "success"
    ANALYSIS_ERROR = "analysis_error"


class InstrumentationIssueCategory(StrEnum):
    """
    Known instrumentation issue categories.
    LLM may return custom categories not defined here.
    """

    MISSING_INSTRUMENTATION = "missing_instrumentation"


def create_instrumentation_issue(
    project_id: int,
    detector_name: str,
    title: str,
    subtitle: str,
    description: str | None = None,
    repository_name: str | None = None,
) -> None:
    detection_time = timezone.now()
    event_id = uuid.uuid4().hex

    # Fetch the project to get its platform
    project = Project.objects.get_from_cache(id=project_id)

    evidence_data: dict[str, Any] = {}
    evidence_display: list[IssueEvidence] = []

    if description:
        evidence_data["description"] = description
        evidence_display.append(
            IssueEvidence(name="Description", value=description, important=True)
        )

    if repository_name:
        evidence_data["repository_name"] = repository_name
        evidence_display.append(
            IssueEvidence(name="Repository", value=repository_name, important=False)
        )

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        project_id=project_id,
        event_id=event_id,
        fingerprint=[f"{detector_name}:{title}"],
        issue_title=title,
        subtitle=subtitle,
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=InstrumentationIssueExperimentalGroupType,
        detection_time=detection_time,
        culprit=detector_name,
        level="info",
    )

    event_data: dict[str, Any] = {
        "event_id": occurrence.event_id,
        "project_id": occurrence.project_id,
        "platform": project.platform or "other",
        "received": detection_time.isoformat(),
        "timestamp": detection_time.isoformat(),
        "tags": {},
    }

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )

    logger.warning(
        "autopilot.instrumentation_issue.created",
        extra={
            "project_id": project_id,
            "detector_name": detector_name,
            "title": title,
        },
    )


class MissingSdkIntegrationsResult(BaseModel):
    """Result schema for missing SDK integrations detection."""

    missing_integrations: list[str]
    finish_reason: str


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


def sample_trace_for_instrumentation_analysis(project: Project) -> TraceMetadata | None:
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
    name="sentry.autopilot.tasks.run_sdk_update_detector",
    namespace=autopilot_tasks,
    processing_deadline_duration=60,
)
def run_sdk_update_detector() -> None:
    organization_allowlist = options.get("autopilot.organization-allowlist")
    if not organization_allowlist:
        return

    organizations = Organization.objects.filter(slug__in=organization_allowlist).all()

    for organization in organizations:
        run_sdk_update_detector_for_organization(organization)


def strip_patch_version(sdk_version: str) -> str:
    return ".".join(sdk_version.split(".")[:2])


def run_sdk_update_detector_for_organization(organization: Organization):
    projects = Project.objects.filter(organization=organization).all()

    if len(projects) == 0:
        return

    metrics.incr("autopilot.sdk_update_detector.projects_found", len(projects))

    with handle_query_errors():
        result: Any = discover.query(
            query="has:sdk.version",
            selected_columns=[
                "project.id",
                "sdk.name",
                "sdk.version",
                "count()",
            ],
            orderby=["project.id", "sdk.name", "sdk.version"],
            limit=1000,
            snuba_params=SnubaParams(
                start=timezone.now() - timedelta(hours=1),
                end=timezone.now(),
                organization=organization,
                projects=list(projects),
            ),
            referrer="autopilot.sdk-update-detector",
        )

    # Filter out SDKs with empty sdk.name or sdk.version or invalid version
    nonempty_sdks = []
    for sdk in result["data"]:
        if not sdk["sdk.name"] or not sdk["sdk.version"]:
            continue

        try:
            version.parse(sdk["sdk.version"])
        except version.InvalidVersion:
            continue

        nonempty_sdks.append(sdk)

    # Sort by project.id to ensure groupby works correctly (groups consecutive elements)
    nonempty_sdks.sort(key=lambda x: x["project.id"])

    # Build datastructure of the latest version of each SDK in use for each
    # project we have events for.
    latest_sdks = list(
        chain.from_iterable(
            [
                {
                    "projectId": str(project_id),
                    "sdkName": sdk_name,
                    "sdkVersion": max((s["sdk.version"] for s in sdks), key=version.parse),
                }
                for sdk_name, sdks in groupby(
                    sorted(sdks_used, key=lambda x: x["sdk.name"]), key=lambda x: x["sdk.name"]
                )
            ]
            for project_id, sdks_used in groupby(nonempty_sdks, key=lambda x: x["project.id"])
        )
    )

    # Determine if each SDK needs an update for each project
    sdk_versions = get_sdk_versions()

    def needs_update(sdk_name, sdk_version):
        if sdk_name not in sdk_versions:
            # Unknown SDK, we can't determine if it needs an update
            return False

        # Ignore patch versions
        try:
            return version.Version(strip_patch_version(sdk_version)) < version.Version(
                strip_patch_version(sdk_versions.get(sdk_name))
            )
        except version.InvalidVersion:
            return False

    updates_list = [
        dict(
            **latest,
            newestSdkVersion=sdk_versions.get(latest["sdkName"]),
            needsUpdate=needs_update(latest["sdkName"], latest["sdkVersion"]),
        )
        for latest in latest_sdks
    ]

    updates_list = [update for update in updates_list if update["needsUpdate"]]

    logger.warning("updates_list: %s", updates_list)
    metrics.incr("autopilot.sdk_update_detector.updates_found", len(updates_list))

    for update in updates_list:
        project_id = int(update["projectId"])
        sdk_name = update["sdkName"]
        current_version = update["sdkVersion"]
        newest_version = update["newestSdkVersion"]

        create_instrumentation_issue(
            project_id=project_id,
            detector_name=AutopilotDetectorName.SDK_UPDATE,
            title=f"SDK Update Available: {sdk_name}",
            subtitle=f"Update from {current_version} to {newest_version}",
            description=f"A newer version of {sdk_name} is available. "
            f"Consider updating from version {current_version} to {newest_version} "
            f"to gain access to bug fixes, performance improvements, and new features.",
        )

    return updates_list


@instrumented_task(
    name="sentry.autopilot.tasks.run_missing_sdk_integration_detector",
    namespace=autopilot_tasks,
    processing_deadline_duration=300,
)
def run_missing_sdk_integration_detector() -> None:
    organization_allowlist = options.get("autopilot.organization-allowlist")
    if not organization_allowlist:
        return

    organizations = Organization.objects.filter(slug__in=organization_allowlist).all()

    for organization in organizations:
        run_missing_sdk_integration_detector_for_organization(organization)


def run_missing_sdk_integration_detector_for_organization(organization: Organization) -> None:
    platform_filter = Q()
    for prefix in SupportedPlatformPrefix:
        platform_filter |= Q(project__platform__startswith=prefix)

    repo_configs = (
        RepositoryProjectPathConfig.objects.filter(
            platform_filter,
            project__organization=organization,
            repository__status=ObjectStatus.ACTIVE,
        )
        .select_related("repository")
        .values("project_id", "repository__name", "source_root")
    )

    for config in repo_configs:
        run_missing_sdk_integration_detector_for_project_task.apply_async(
            args=(
                organization.id,
                config["project_id"],
                config["repository__name"],
                config["source_root"],
            ),
            headers={"sentry-propagate-traces": False},
        )


@instrumented_task(
    name="sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task",
    namespace=autopilot_tasks,
    processing_deadline_duration=280,
)
def run_missing_sdk_integration_detector_for_project_task(
    organization_id: int, project_id: int, repo_name: str, source_root: str
) -> list[str] | None:
    """
    Detect missing SDK integrations for a project using Seer Explorer.

    Returns:
        List of missing integration names, or None if detection failed.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
        project = Project.objects.get(id=project_id)
    except (Organization.DoesNotExist, Project.DoesNotExist):
        logger.warning(
            "missing_sdk_integration_detector.entity_not_found",
            extra={"organization_id": organization_id, "project_id": project_id},
        )
        return None

    try:
        client = SeerExplorerClient(
            organization,
            user=None,
            category_key=AutopilotDetectorName.MISSING_SDK_INTEGRATION,
            category_value=str(project.id),
            intelligence_level="medium",
        )
    except SeerPermissionError:
        logger.warning(
            "missing_sdk_integration_detector.no_seer_access",
            extra={"organization_id": organization.id, "project_id": project.id},
        )
        return None

    if project.platform not in INTEGRATION_ID_TO_PLATFORM_DATA:
        logger.warning(
            "missing_sdk_integration_detector.platform_data_lookup.not_found",
            extra={
                "platform": project.platform,
            },
        )

    # Get docs URL from platform data
    platform_data = INTEGRATION_ID_TO_PLATFORM_DATA.get(project.platform or "", {})
    docs_url = platform_data.get("link", None)
    if project.platform and project.platform.startswith(SupportedPlatformPrefix.PYTHON):
        integration_docs_url = "https://docs.sentry.io/platforms/python/integrations/"
    elif docs_url:
        integration_docs_url = f"{docs_url}configuration/integrations/"
    else:
        integration_docs_url = "https://docs.sentry.io/platforms/"

    prompt = f"""# Objective
Find missing Sentry SDK integrations for the project `{project.slug}` in repository `{repo_name}`.

# Locate Project Directory
The project should be at: `{source_root or "/"}`

If this path doesn't exist or contains no dependency files:
1. Check the repository root
2. Look for a directory named `{project.slug}`
3. Check common monorepo locations: `packages/`, `apps/`, `services/`

Once located, analyze ONLY that directory. Do not read files from parent or sibling directories.

# Steps

1. **Read Dependencies**
   Read the {project.platform} dependency file from the project directory:
   - JavaScript/Node: `package.json`
   - Python: `requirements.txt`, `pyproject.toml`, or `setup.py`
   - Ruby: `Gemfile`
   - Go: `go.mod`
   - Java: `pom.xml` or `build.gradle`
   - PHP: `composer.json`
   If you cannot find any dependency file, return `{MissingSdkIntegrationFinishReason.MISSING_DEPENDENCY_FILE}` as the finish reason and an empty list of missing integrations.

2. **Read Sentry Configuration**
   Search for Sentry initialization (`Sentry.init` or `sentry_sdk.init`) within the project directory and note configured integrations.
   If you cannot find any Sentry initialization, return `{MissingSdkIntegrationFinishReason.MISSING_SENTRY_INIT}` as the finish reason and an empty list of missing integrations.

3. **Read SDK Integrations Docs**
   Fetch the integrations table from: {integration_docs_url}
   Note integration names and whether they are auto-enabled.

4. **Read Missing Integrations Docs**
   For each identified missing integration, read the documentation link for that integration and double check if it is really tied to a specific package in the project's dependencies and if it is applicable to the project.

# Acceptance Criteria

Only report an integration if ALL of the following are true. Check each criterion one by one:

1. [ ] The integration has a **specific package dependency** (e.g., `zodErrorsIntegration` requires `zod`)
2. [ ] That package exists in the project's dependency file
3. [ ] The integration is NOT marked as auto-enabled in the docs
4. [ ] The integration is NOT already configured in `Sentry.init`
5. [ ] The integration is NOT explicitly disabled in `Sentry.init`

General-purpose integrations that don't require a specific package (e.g., `extraErrorDataIntegration`, `replayIntegration`, `feedbackIntegration`, `captureConsoleIntegration`) will never pass criterion 1.

# Output

Return a JSON object with:
- `missing_integrations`: Array of missing integration names using exact names from the docs
- `finish_reason`: A short snake_case string describing the outcome:
  - `{MissingSdkIntegrationFinishReason.SUCCESS}`: Successfully analyzed the project (even if no integrations are missing)
  - `{MissingSdkIntegrationFinishReason.MISSING_SENTRY_INIT}`: Could not find Sentry initialization code (`Sentry.init` or `sentry_sdk.init`)
  - `{MissingSdkIntegrationFinishReason.MISSING_DEPENDENCY_FILE}`: Could not find any dependency file for the project
  - For other issues, use a descriptive snake_case reason (e.g., `docs_unavailable`)

Example success: `{{"missing_integrations": ["zodErrorsIntegration"], "finish_reason": "{MissingSdkIntegrationFinishReason.SUCCESS}"}}`
Example no missing: `{{"missing_integrations": [], "finish_reason": "{MissingSdkIntegrationFinishReason.SUCCESS}"}}`
Example no init: `{{"missing_integrations": [], "finish_reason": "{MissingSdkIntegrationFinishReason.MISSING_SENTRY_INIT}"}}`"""

    try:
        run_id = client.start_run(
            prompt,
            artifact_key="missing_integrations",
            artifact_schema=MissingSdkIntegrationsResult,
        )
        with metrics.timer(
            "autopilot.missing_sdk_integration_detector.run_duration",
            tags={"project_slug": project.slug},
            sample_rate=1.0,
        ):
            state = client.get_run(run_id, blocking=True, poll_timeout=240.0, poll_interval=5.0)

        # Extract the structured result
        result = state.get_artifact("missing_integrations", MissingSdkIntegrationsResult)
        if result is None:
            logger.warning(
                "missing_sdk_integration_detector.no_artifact_result",
                extra={
                    "organization_id": organization.id,
                    "project_id": project.id,
                    "run_id": run_id,
                },
            )
            return None

        missing_integrations = result.missing_integrations
        finish_reason = result.finish_reason

        logger.warning(
            "missing_sdk_integration_detector.integrations_found: %s",
            missing_integrations,
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "project_slug": project.slug,
                "platform": project.platform,
                "repo_name": repo_name,
                "run_id": run_id,
                "finish_reason": finish_reason,
            },
        )

        # Only create issues if the detection was successful
        if finish_reason == MissingSdkIntegrationFinishReason.SUCCESS:
            for integration in missing_integrations:
                create_instrumentation_issue(
                    project_id=project.id,
                    detector_name=AutopilotDetectorName.MISSING_SDK_INTEGRATION,
                    title=f"Missing SDK Integration: {integration}",
                    # TODO: Generate subtitle and description using AI
                    subtitle="Get better insights by enabling this integration",
                    description=f"The {integration} SDK integration is available for your project but not configured. "
                    f"Adding this integration can improve error tracking and provide better insights into your application's behavior. "
                    f"Learn more at: {integration_docs_url}",
                    repository_name=repo_name,
                )

        return missing_integrations

    except Exception as e:
        logger.exception(
            "autopilot.missing_sdk_integration_detector.error",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "project_slug": project.slug,
                "error_message": str(e),
            },
        )
        return None


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
        project = Project.objects.get(id=project_id)
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

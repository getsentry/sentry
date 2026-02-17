import logging
from enum import StrEnum

from pydantic import BaseModel, Field

from sentry import options
from sentry.autopilot.tasks.common import AutopilotDetectorName, create_instrumentation_issue
from sentry.constants import INTEGRATION_ID_TO_PLATFORM_DATA, ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.models import SeerPermissionError
from sentry.seer.seer_setup import has_seer_access
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import autopilot_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class SupportedPlatformPrefix(StrEnum):
    JAVASCRIPT = "javascript"
    NODE = "node"
    PYTHON = "python"


class MissingSdkIntegrationFinishReason(StrEnum):
    SUCCESS = "success"
    MISSING_SENTRY_INIT = "missing_sentry_init"
    MISSING_DEPENDENCY_FILE = "missing_dependency_file"
    CODE_PATH_NOT_FOUND = "code_path_not_found"


class MissingSdkIntegrationDetail(BaseModel):
    """Detail about a single missing SDK integration."""

    name: str = Field(..., min_length=1, max_length=200)
    summary: str = Field(..., min_length=1, max_length=500)
    docs_url: str = Field(..., min_length=1, max_length=500)


class MissingSdkIntegrationsResult(BaseModel):
    """Result schema for missing SDK integrations detection."""

    missing_integrations: list[MissingSdkIntegrationDetail]
    finish_reason: str


@instrumented_task(
    name="sentry.autopilot.tasks.run_missing_sdk_integration_detector",
    namespace=autopilot_tasks,
    processing_deadline_duration=300,
)
def run_missing_sdk_integration_detector() -> None:
    project_ids = options.get("autopilot.missing-sdk-integration.projects-allowlist")
    if not project_ids:
        return

    for project_id in project_ids:
        try:
            project = Project.objects.select_related("organization").get(id=project_id)
        except Project.DoesNotExist:
            logger.warning(
                "missing_sdk_integration_detector.project_not_found",
                extra={"project_id": project_id},
            )
            continue

        # Check gen AI consent before spawning child tasks
        if not has_seer_access(project.organization):
            logger.info(
                "missing_sdk_integration_detector.no_gen_ai_access",
                extra={"project_id": project_id, "organization_id": project.organization_id},
            )
            continue

        # Check platform support
        platform_supported = any(
            project.platform and project.platform.startswith(prefix)
            for prefix in SupportedPlatformPrefix
        )
        if not platform_supported:
            logger.info(
                "missing_sdk_integration_detector.unsupported_platform",
                extra={"project_id": project_id, "platform": project.platform},
            )
            continue

        # Get repo configs for this project
        repo_names = (
            RepositoryProjectPathConfig.objects.filter(
                project=project,
                repository__status=ObjectStatus.ACTIVE,
                repository__provider="integrations:github",
            )
            .order_by("repository__name")
            .distinct("repository__name")
            .values_list("repository__name", flat=True)
        )
        for repo_name in repo_names:
            run_missing_sdk_integration_detector_for_project_task.apply_async(
                args=(
                    project.organization_id,
                    project.id,
                    repo_name,
                ),
                headers={"sentry-propagate-traces": False},
            )


def _record_error(project_id: int, error_type: str) -> None:
    metrics.incr(
        "autopilot.missing_sdk_integration_detector.error",
        tags={
            "project_id": str(project_id),
            "error_type": error_type,
        },
        sample_rate=1.0,
    )


@instrumented_task(
    name="sentry.autopilot.tasks.run_missing_sdk_integration_detector_for_project_task",
    namespace=autopilot_tasks,
    processing_deadline_duration=280,
)
def run_missing_sdk_integration_detector_for_project_task(
    organization_id: int, project_id: int, repo_name: str
) -> list[str] | None:
    """
    Detect missing SDK integrations for a project using Seer Explorer.

    Returns:
        List of missing integration names, or None if detection failed.
    """
    metrics.incr(
        "autopilot.missing_sdk_integration_detector.run",
        tags={"project_id": str(project_id)},
        sample_rate=1.0,
    )

    logger.info(
        "missing_sdk_integration_detector.run_started",
        extra={
            "organization_id": organization_id,
            "project_id": project_id,
            "repo_name": repo_name,
        },
    )

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
        _record_error(project.id, "SeerPermissionError")
        logger.exception(
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
    docs_url = platform_data.get("link")
    if project.platform and project.platform.startswith(SupportedPlatformPrefix.PYTHON):
        integration_docs_url = "https://docs.sentry.io/platforms/python/integrations/"
    elif docs_url:
        integration_docs_url = f"{docs_url}configuration/integrations/"
    else:
        integration_docs_url = "https://docs.sentry.io/platforms/"

    prompt = f"""# Objective
Find missing Sentry SDK integrations for the project `{project.slug}` in repository `{repo_name}`.

# Locate Project Directory
Find the directory in the repository that contains the {project.platform} project `{project.slug}`.

Use these hints to locate it:
1. Check the repository root for dependency files
2. Look for a directory named `{project.slug}` or similarly named
3. Check common monorepo locations: `packages/`, `apps/`, `services/`
4. Look for directories containing {project.platform} dependency files

If you cannot locate the project directory, return `{MissingSdkIntegrationFinishReason.CODE_PATH_NOT_FOUND}` as the finish reason and an empty list of missing integrations.

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

General-purpose integrations that don't require a specific package (e.g., `extraErrorDataIntegration`, `replayIntegration`, `feedbackIntegration`, `captureConsoleIntegration`, `httpClientIntegration`, `browserTracingIntegration`) will never pass criterion 1.

# Output

Return a JSON object with:
- `missing_integrations`: Array of objects, each with:
  - `name`: The exact integration name from the docs (e.g., `zodErrorsIntegration`)
  - `summary`: A 1-2 sentence summary explaining what features this integration enables and why it is relevant to the project (e.g., which dependency triggers it)
  - `docs_url`: The full URL to the integration's documentation page on docs.sentry.io
- `finish_reason`: A short snake_case string describing the outcome:
  - `{MissingSdkIntegrationFinishReason.SUCCESS}`: Successfully analyzed the project (even if no integrations are missing)
  - `{MissingSdkIntegrationFinishReason.MISSING_SENTRY_INIT}`: Could not find Sentry initialization code (`Sentry.init` or `sentry_sdk.init`)
  - `{MissingSdkIntegrationFinishReason.MISSING_DEPENDENCY_FILE}`: Could not find any dependency file for the project
  - `{MissingSdkIntegrationFinishReason.CODE_PATH_NOT_FOUND}`: Could not locate the project directory in the repository
  - For other issues, use a descriptive snake_case reason (e.g., `docs_unavailable`)

Example success: `{{"missing_integrations": [{{"name": "zodErrorsIntegration", "summary": "Enable richer Zod validation errors in Sentry — since your project already uses the zod package, adding this integration gives you detailed schema context on every validation failure.", "docs_url": "https://docs.sentry.io/platforms/javascript/configuration/integrations/zod/"}}], "finish_reason": "{MissingSdkIntegrationFinishReason.SUCCESS}"}}`
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
            _record_error(project.id, "no_artifact_result")
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
        integrations_count = len(missing_integrations)

        logger.warning(
            "missing_sdk_integration_detector.integrations_found",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "project_slug": project.slug,
                "platform": project.platform,
                "repo_name": repo_name,
                "run_id": run_id,
                "finish_reason": finish_reason,
                "integrations_count": integrations_count,
            },
        )

        if integrations_count > 0:
            metrics.incr(
                "autopilot.missing_sdk_integration_detector.integrations_found",
                sample_rate=1.0,
            )

        # Only create issues if the detection was successful
        if finish_reason == MissingSdkIntegrationFinishReason.SUCCESS:
            for integration in missing_integrations:
                description = f"{integration.summary}\n\n" f"Learn more: {integration.docs_url}"

                logger.info(
                    "missing_sdk_integration_detector.issue_would_be_created",
                    extra={
                        "project_id": project.id,
                        "project_slug": project.slug,
                        "integration": integration.name,
                        "title": f"Missing SDK Integration: {integration.name}",
                        "subtitle": integration.summary,
                        "description": description,
                        "repository_name": repo_name,
                        "docs_url": integration.docs_url,
                    },
                )
                metrics.incr(
                    "autopilot.missing_sdk_integration_detector.issue_created",
                    tags={"project_id": str(project.id), "integration": integration.name},
                    sample_rate=1.0,
                )
                create_instrumentation_issue(
                    project_id=project.id,
                    detector_name=AutopilotDetectorName.MISSING_SDK_INTEGRATION,
                    title=f"Missing SDK Integration: {integration.name}",
                    subtitle=integration.summary,
                    description=description,
                    repository_name=repo_name,
                )

        return [i.name for i in missing_integrations]

    except Exception as e:
        _record_error(project.id, type(e).__name__)
        logger.exception(
            "autopilot.missing_sdk_integration_detector.error",
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "project_slug": project.slug,
            },
        )
        return None

import logging
from enum import StrEnum

from django.db.models import Q
from pydantic import BaseModel

from sentry import options
from sentry.autopilot.tasks.common import AutopilotDetectorName, create_instrumentation_issue
from sentry.constants import INTEGRATION_ID_TO_PLATFORM_DATA, ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.models import SeerPermissionError
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


class MissingSdkIntegrationsResult(BaseModel):
    """Result schema for missing SDK integrations detection."""

    missing_integrations: list[str]
    finish_reason: str


@instrumented_task(
    name="sentry.autopilot.tasks.run_missing_sdk_integration_detector",
    namespace=autopilot_tasks,
    processing_deadline_duration=300,
)
def run_missing_sdk_integration_detector() -> None:
    organization_allowlist = options.get("autopilot.organization-allowlist")
    if not organization_allowlist:
        return

    organizations = Organization.objects.filter(slug__in=organization_allowlist)

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

import logging
import uuid
from datetime import timedelta
from enum import StrEnum
from itertools import chain, groupby
from typing import Any

from django.utils import timezone
from packaging import version
from pydantic import BaseModel

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
from sentry.seer.models import SeerPermissionError
from sentry.snuba import discover
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import autopilot_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class AutopilotDetectorName(StrEnum):
    SDK_UPDATE = "sdk-update"
    MISSING_SDK_INTEGRATION = "missing-sdk-integration"


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
    projects = Project.objects.filter(organization=organization).all()

    if len(projects) == 0:
        return

    for project in projects:
        # Get the repository mapped to this project via RepositoryProjectPathConfig
        repo_config = (
            RepositoryProjectPathConfig.objects.filter(
                project=project,
                repository__status=ObjectStatus.ACTIVE,
            )
            .select_related("repository")
            .first()
        )

        if repo_config:
            run_missing_sdk_integration_detector_for_project(
                organization, project, repo_config.repository.name, repo_config.source_root
            )


def run_missing_sdk_integration_detector_for_project(
    organization: Organization, project: Project, repo_name: str, source_root: str
) -> list[str] | None:
    """
    Detect missing SDK integrations for a project using Seer Explorer.

    Returns:
        List of missing integration names, or None if detection failed.
    """
    try:
        client = SeerExplorerClient(
            organization,
            user=None,
            category_key=AutopilotDetectorName.MISSING_SDK_INTEGRATION,
            category_value=str(project.id),
            intelligence_level="low",
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
    integration_docs_url = (
        f"{docs_url}configuration/integrations/"
        if docs_url
        else "https://docs.sentry.io/platforms/"
    )

    prompt = f"""# Objective

Identify missing Sentry SDK integrations for a project by analyzing its code repository: {repo_name}

# Instructions

Follow these steps in order:

## Step 1: Explore Repository Structure

**Before reading any files**, retrieve and examine the complete folder structure of the repository.

This is critical because:
- The repository may be a monorepo with multiple projects
- Dependency files may exist at different levels (root, subdirectories, packages)
- Understanding the structure helps identify the correct project location

List all directories and files recursively to understand the repository layout. Pay attention to:
- Top-level directories that may indicate separate projects or packages
- Nested `packages/`, `apps/`, `services/`, or similar directories common in monorepos
- Location of dependency files (`package.json`, `requirements.txt`, etc.) at various levels

## Step 2: Locate the Project Directory

Using the folder structure from Step 1, identify and scope your analysis to the correct project.

Use these hints to locate the project:
- **Source Root**: `{source_root or "/"}` - This is the primary indicator of where the project code lives
- **Project Slug**: `{project.slug}` - The project name, which may correspond to a directory name
- **Platform**: `{project.platform}` - The technology stack (e.g., JavaScript, Python) helps identify which dependency files are relevant

Navigation:
- If the Source Root is "/" or empty, the project is likely at the repository root
- Otherwise, navigate to the Source Root path within the repository
- If Source Root doesn't exist, look for a directory fuzzily matching the project slug

**All subsequent steps MUST be scoped exclusively to this project directory. Do NOT analyze files from other projects in the monorepo.**

## Step 3: Identify Project Dependencies

Locate and analyze dependency files **only within the project directory identified in Step 2**.

Look for platform-appropriate dependency files:
- `package.json` (Node.js/JavaScript)
- `requirements.txt`, `pyproject.toml`, `setup.py` (Python)
- `Gemfile` (Ruby)
- `go.mod` (Go)
- `pom.xml`, `build.gradle` (Java)
- `composer.json` (PHP)

**Monorepo Warning**: Do NOT read dependency files from:
- Parent directories (unless the project is at the root)
- Sibling project directories
- Unrelated subdirectories

Extract only the libraries and frameworks that THIS specific project uses.

## Step 4: Review Available Sentry Integrations

1. Read the **SDK Integrations Documentation** URL: {integration_docs_url}
2. Locate the integrations table on that page
3. Note the exact integration name as listed in the table (e.g., "zodErrorIntegration")
5. Check the "Auto Enabled" column to identify integrations that require manual configuration

## Step 5: Check Current Sentry Configuration

Search for existing Sentry initialization code (e.g., `Sentry.init`, `sentry_sdk.init`) within the project directory.
Note which integrations are already explicitly configured.

## Step 6: Determine Missing Integrations

Compare the available integrations (Step 4) against the configured integrations (Step 5).
An integration is "missing" if ALL of the following are true:
- The integration corresponds to a **specific package** found in the project's dependencies (Step 3)
- The integration is NOT auto-enabled
- The integration is NOT already configured
- The integration is NOT explicitly disabled

**Important**: Only report integrations that have a direct 1:1 mapping to a package in the project's dependencies.
Do NOT report general-purpose integrations that don't require a specific package (e.g., `extraErrorDataIntegration`, `replayIntegration`, `feedbackIntegration`, `captureConsoleIntegration`).

# Output

Return a JSON array of strings containing the missing SDK integration names.
**Important**: Use the exact integration names from the documentation table.

Example: For a project using the `zod` package, report `["zodErrorIntegration"]`

If no missing integrations are found, return an empty array: `[]`"""

    try:
        run_id = client.start_run(
            prompt,
            artifact_key="missing_integrations",
            artifact_schema=MissingSdkIntegrationsResult,
        )
        state = client.get_run(run_id, blocking=True, poll_timeout=120.0)

        # Extract the structured result
        result = state.get_artifact("missing_integrations", MissingSdkIntegrationsResult)
        missing_integrations = result.missing_integrations if result else []

        logger.warning(
            "missing_sdk_integration_detector.integrations_found: %s",
            missing_integrations,
            extra={
                "organization_id": organization.id,
                "project_id": project.id,
                "project_slug": project.slug,
                "platform": project.platform,
                "repo_name": repo_name,
            },
        )

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

    except Exception:
        logger.exception(
            "autopilot.missing_sdk_integration_detector.error",
            extra={"organization_id": organization.id, "project_id": project.id},
        )
        return None

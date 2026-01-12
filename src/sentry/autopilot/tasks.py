import logging
from datetime import timedelta
from itertools import chain, groupby
from typing import Any

from django.utils import timezone
from packaging import version
from pydantic import BaseModel

from sentry import options
from sentry.api.utils import handle_query_errors
from sentry.constants import INTEGRATION_ID_TO_PLATFORM_DATA, ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
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
    logger.warning("sdk_versions: %s", sdk_versions)
    logger.warning("latest_sdks: %s", latest_sdks)

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
            category_key="missing-sdk-integration-detector",
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

Identify missing Sentry SDK integrations for a project by analyzing its code repository.

# Context

- **Project**: {project.slug}
- **Repository**: {repo_name}
- **Source Root**: {source_root or "/"}
- **Platform**: {project.platform}
- **SDK Integrations Documentation**: {integration_docs_url}

# Instructions

Follow these steps in order:

## Step 1: Locate the Project Directory

The repository may contain multiple projects. Use the **Source Root** path to identify the correct project directory.
- If the Source Root is "/" or empty, the project is at the repository root
- Otherwise, navigate to the Source Root path within the repository

All subsequent steps should be scoped to this directory.

## Step 2: Identify Project Dependencies

Locate and analyze dependency files within the project directory, like:
- `package.json` (Node.js/JavaScript)
- `requirements.txt`, `pyproject.toml`, `setup.py` (Python)
- `Gemfile` (Ruby)
- `go.mod` (Go)
- `pom.xml`, `build.gradle` (Java)
- `composer.json` (PHP)

Extract the list of libraries and frameworks the project uses.

## Step 3: Review Available Sentry Integrations

Reference the SDK integrations documentation to identify which integrations:
- Are available for the detected libraries/frameworks
- Require manual configuration (not auto-enabled by default)

## Step 4: Check Current Sentry Configuration

Search for existing Sentry initialization code (e.g., `Sentry.init`, `sentry_sdk.init`) within the project directory.
Note which integrations are already explicitly configured.

## Step 5: Determine Missing Integrations

Compare the available integrations (Step 3) against the configured integrations (Step 4).
An integration is "missing" if:
- A library/framework in the project has a corresponding Sentry integration
- The integration requires manual setup
- The integration is NOT already configured

# Output

Return a JSON array of strings containing the missing SDK integration names.

Example: `["celery", "redis", "sqlalchemy"]`

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

        return missing_integrations

    except Exception:
        logger.exception(
            "autopilot.missing_sdk_integration_detector.error",
            extra={"organization_id": organization.id, "project_id": project.id},
        )
        return None

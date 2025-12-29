import logging
from datetime import timedelta
from itertools import chain, groupby
from typing import Any

from django.utils import timezone
from packaging import version

from sentry import options
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sdk_updates import get_sdk_versions
from sentry.search.events.types import SnubaParams
from sentry.snuba import discover
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import autopilot_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)


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
    latest_sdks = chain.from_iterable(
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

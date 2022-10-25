import logging
from datetime import timedelta
from typing import Any, List, Mapping, Set

from django.utils import timezone

from sentry import features
from sentry.db.models.fields.node import NodeData
from sentry.integrations.utils.code_mapping import derive_code_mappings
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.utils.json import JSONData
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.safe import get_path

ACTIVE_PROJECT_THRESHOLD = timedelta(days=7)
GROUP_ANALYSIS_RANGE = timedelta(days=14)

logger = logging.getLogger("sentry.tasks.derive_code_mappings")


@instrumented_task(
    name="sentry.tasks.derive_code_mappings.process_organizations",
    queue="derive_code_mappings",
    max_retries=0,
)  # type: ignore
def derive_missing_codemappings(dry_run=False) -> None:
    """
    Queue tasks to process each organization to derive missing codemappings.
    """
    organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    for _, organization in enumerate(
        RangeQuerySetWrapper(organizations, step=1000, result_value_getter=lambda item: item.id)
    ):
        if not features.has("organizations:derive-code-mappings", organization):
            continue

        # Create a celery task per organization
        project_stacktrace_paths = identify_stacktrace_paths.delay(organization.id, dry_run=dry_run)
        if not project_stacktrace_paths:
            continue

        try:
            integration = Integration.objects.get(
                organizations=organization.id,
                provider="github",
            )
        except Integration.DoesNotExist:
            logger.exception(f"Github integration not found for {organization.id}")

        if not integration:
            continue

        install = integration.get_installation(organization.id)
        trees: JSONData = install.get_trees_for_org()
        for project, stacktrace_paths in project_stacktrace_paths.items():
            # TODO(snigdha): set the derived code mapping
            code_mappings = derive_code_mappings(project, stacktrace_paths, trees)


@instrumented_task(  # type: ignore
    name="sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
    queue="derive_code_mappings",
    max_retries=0,  # if we don't backfill it this time, we'll get it the next time
)
def identify_stacktrace_paths(organization: Organization, dry_run=False) -> Mapping[str, List[str]]:
    """
    Generate a map of projects to stacktrace paths for an organization.

    This filters out non-python projects, or projects without an event
    in the last 7 days.
    """
    projects = Project.objects.filter(
        organization=organization,
        first_event__isnull=False,
    )
    projects = [
        project
        for project in projects
        if Group.objects.filter(
            project=project,
            last_seen__gte=timezone.now() - ACTIVE_PROJECT_THRESHOLD,
        ).exists()
    ]

    project_file_map = {project.slug: get_all_stacktrace_paths(project) for project in projects}
    return project_file_map


def get_all_stacktrace_paths(project: Project) -> List[str]:
    groups = Group.objects.filter(
        project=project,
        last_seen__gte=timezone.now() - GROUP_ANALYSIS_RANGE,
        platform="python",
    )

    all_stacktrace_paths = set()
    for group in groups:
        event = group.get_latest_event()
        all_stacktrace_paths.update(get_stacktrace_paths(event.data))

    return list(all_stacktrace_paths)


def get_stacktrace_paths(data: NodeData) -> Set[str]:
    """
    Get the stacktrace_paths from the stacktrace for the latest event for an issue.
    """
    stacktraces = get_stacktrace(data)
    stacktrace_paths = set()
    for stacktrace in stacktraces:
        try:
            paths = {frame["filename"] for frame in stacktrace["frames"]}
            stacktrace_paths.update(paths)
        except Exception:
            logger.exception("Error getting filenames for project {project.slug}")
    return stacktrace_paths


def get_stacktrace(data: NodeData) -> List[Mapping[str, Any]]:
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        return [e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames")]

    stacktrace = data.get("stacktrace")
    if stacktrace and stacktrace.get("frames"):
        return [stacktrace]

    return []

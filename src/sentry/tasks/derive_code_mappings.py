import logging
from datetime import timedelta
from typing import Any, List, Mapping, Optional, Set

from django.utils import timezone

from sentry.db.models.fields.node import NodeData
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.organization import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.utils.safe import get_path

ACTIVE_PROJECT_THRESHOLD = timedelta(days=7)
GROUP_ANALYSIS_RANGE = timedelta(days=14)

logger = logging.getLogger("sentry.tasks.derive_code_mappings")


@instrumented_task(  # type: ignore
    name="sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
    queue="derive_code_mappings",
    max_retries=0,  # if we don't backfill it this time, we'll get it the next time
)
def identify_stacktrace_paths(
    organizations: Optional[List[Organization]] = None,
) -> Mapping[str, Mapping[str, List[str]]]:
    """
    Generate a map of projects to stacktrace paths for specified organizations,
    or all active organizations if unspecified.

    This filters out non-python projects, or projects without an event
    in the last 7 days.
    """
    if organizations is None:
        organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)

    filename_maps = {}
    for org in organizations:
        projects = Project.objects.filter(
            organization=org,
            first_event__isnull=False,
            platform="python",
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
        filename_maps[org.slug] = project_file_map
    return filename_maps


def get_all_stacktrace_paths(project: Project) -> List[str]:
    groups = Group.objects.filter(
        project=project, last_seen__gte=timezone.now() - GROUP_ANALYSIS_RANGE
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
            paths = [frame["filename"] for frame in stacktrace["frames"]]
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

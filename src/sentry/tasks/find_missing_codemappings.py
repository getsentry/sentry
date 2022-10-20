import logging
from ast import Tuple
from datetime import timedelta
from typing import List

from django.utils import timezone

from sentry.db.models.fields.node import NodeData
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.organization import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.utils.safe import get_path

PREFERRED_GROUP_OWNERS = 1
PREFERRED_GROUP_OWNER_AGE = timedelta(days=7)

logger = logging.getLogger("sentry.tasks.find_missing_codemappings")


@instrumented_task(
    name="sentry.tasks.find_missing_codemappings",
    queue="find_missing_codemappings",
    max_retries=0,  # if we don't backfill it this time, we'll get it the next time
)
def find_missing_codemappings(**kwargs):
    organizations = kwargs.get(
        "organizations", Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    )

    filename_maps = {}
    for org in organizations:
        projects = Project.objects.filter(organization=org, first_event__isnull=False)

        projects = [
            project
            for project in projects
            if Group.objects.filter(
                project=project, last_seen__gte=timezone.now() - timedelta(days=PREFERRED_GROUP_OWNER_AGE)
            ).exists()
        ]

        project_file_map = {project.slug: get_all_filenames(project) for project in projects}
        filename_maps[org.slug] = project_file_map
    return filename_maps


def get_all_stacktrace_paths(project):
    groups = Group.objects.filter(
        project=project, last_seen__gte=timezone.now() - timedelta(days=GROUP_ANALYSIS_RANGE)
    )

    all_stacktrace_paths = set()
    for group in groups:
        event = group.get_latest_event()
        is_python_stacktrace, stacktrace_paths = get_stacktrace_paths(project, event.data)
        if not is_python_project:
            return []
        all_stacktrace_paths.update(stacktrace_paths)

    return list(stacktrace_paths)


# Get the filenames from the stacktrace for the latest event for an issue.
def get_filenames(project: Project, data: NodeData) -> Tuple(bool, List[str]):
    stacktraces = get_stacktrace(data)
    filenames = set()
    for st in stacktraces:
        try:
            fn = [frame["filename"] for frame in st["frames"]]
            if fn[0].endswith(".py"):
                filenames.update(fn)
            else:
                return False, []  # (is_python, filenames)
        except Exception as e:
            logger.exception("Error getting filenames for project {project.slug}")
    return True, filenames  # (is_python, filenames)


def get_stacktrace(data: NodeData) -> List[str]:
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        return [e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames")]

    stacktrace = data.get("stacktrace")
    if stacktrace and stacktrace.get("frames"):
        return [stacktrace]

    return None

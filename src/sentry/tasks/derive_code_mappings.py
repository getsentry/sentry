import logging
from datetime import timedelta
from typing import Any, List, Mapping, Set

from django.utils import timezone

from sentry import features
from sentry.api.endpoints.organization_code_mappings import RepositoryProjectPathConfigSerializer
from sentry.db.models.fields.node import NodeData
from sentry.integrations.utils.code_mapping import CodeMapping, derive_code_mappings
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
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

        integration = None
        try:
            integration = Integration.objects.filter(
                organizations=organization.id,
                provider="github",
            )
        except Integration.DoesNotExist:
            logger.exception(f"Github integration not found for {organization.id}")

        if integration is None or not integration.exists():
            continue

        integration = integration.first()
        organization_integration = OrganizationIntegration.objects.filter(
            organization=organization, integration=integration
        )
        if not organization_integration.exists():
            continue

        organization_integration = organization_integration.first()
        install = integration.get_installation(organization.id)
        trees: JSONData = install.get_trees_for_org()
        for project, stacktrace_paths in project_stacktrace_paths.items():
            code_mappings = derive_code_mappings(stacktrace_paths, trees)
            set_project_codemappings(code_mappings, organization, organization_integration, project)


# Given a list of code mappings, create a new repository project path
# config for each mapping.
def set_project_codemappings(
    code_mappings: List[CodeMapping],
    organization: Organization,
    organization_integration: OrganizationIntegration,
    project: Project,
) -> None:
    for code_mapping in code_mappings:
        serializer = RepositoryProjectPathConfigSerializer(
            data={
                "project_id": project.id,
                "stack_root": code_mapping.stacktrace_root,
                "source_root": code_mapping.source_path,
                "repo_id": code_mapping.repo,
            },
            context={
                "organization": organization,
                "organization_integration": organization_integration,
            },
        )
        if serializer.is_valid():
            serializer.save()
        else:
            logger.error(
                "Error saving code mapping for organization %s: %s",
                organization.id,
                serializer.errors,
            )


@instrumented_task(  # type: ignore
    name="sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
    queue="derive_code_mappings",
    max_retries=0,  # if we don't backfill it this time, we'll get it the next time
)
def identify_stacktrace_paths(
    organization: Organization, dry_run=False
) -> Mapping[Project, List[str]]:
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

    project_file_map = {project: get_all_stacktrace_paths(project) for project in projects}
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

import logging
from datetime import timedelta
from typing import Any, List, Mapping, Set, Tuple

from django.utils import timezone

from sentry import features
from sentry.db.models.fields.node import NodeData
from sentry.integrations.utils.code_mapping import CodeMapping, CodeMappingTreesHelper
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.repository import Repository
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
        derive_code_mappings.delay(organization.id)


@instrumented_task(  # type: ignore
    name="sentry.tasks.derive_code_mappings.derive_code_mappings",
    queue="derive_code_mappings",
    max_retries=0,  # if we don't backfill it this time, we'll get it the next time
)
def derive_code_mappings(organization_id: int, dry_run=False) -> None:
    """
    Derive code mappings for an organization and save the derived code mappings.
    """
    organization: Organization = Organization.objects.get(id=organization_id)
    project_stacktrace_paths = identify_stacktrace_paths(organization)
    if not project_stacktrace_paths:
        return

    installation, organization_integration = get_installation(organization)
    if not installation:
        return

    trees: JSONData = installation.get_trees_for_org()
    trees_helper = CodeMappingTreesHelper(trees)
    for project, stacktrace_paths in project_stacktrace_paths.items():
        code_mappings = trees_helper.generate_code_mappings(stacktrace_paths)
        set_project_codemappings(code_mappings, organization, organization_integration, project)


def identify_stacktrace_paths(organization: Organization) -> Mapping[Project, List[str]]:
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

    return {project: get_all_stacktrace_paths(project) for project in projects}


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


def get_installation(organization: Organization) -> Tuple[Integration, OrganizationIntegration]:
    integration = None
    try:
        integration = Integration.objects.filter(
            organizations=organization,
            provider="github",
        )
    except Integration.DoesNotExist:
        logger.exception(f"Github integration not found for {organization.id}")
        return None, None

    if not integration.exists():
        return None, None

    integration = integration.first()
    organization_integration = OrganizationIntegration.objects.filter(
        organization=organization, integration=integration
    )
    if not organization_integration.exists():
        return None, None

    organization_integration = organization_integration.first()
    return integration.get_installation(organization.id), organization_integration


def set_project_codemappings(
    code_mappings: List[CodeMapping],
    organization: Organization,
    organization_integration: OrganizationIntegration,
    project: Project,
) -> None:
    """
    Given a list of code mappings, create a new repository project path
    config for each mapping.
    """
    for code_mapping in code_mappings:
        repository, _ = Repository.objects.get_or_create(
            name=code_mapping.repo.name,
            organization_id=organization.id,
            defaults={
                "name": code_mapping.repo.name,
                "organization_id": organization.id,
                "integration_id": organization_integration.integration_id,
            },
        )

        RepositoryProjectPathConfig.objects.create(
            project=project,
            repository=repository,
            organization_integration=organization_integration,
            stack_root=code_mapping.stacktrace_root,
            source_root=code_mapping.source_path,
            default_branch=code_mapping.repo.branch,
            automatically_generated=True,
        )

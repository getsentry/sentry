import logging
from datetime import timedelta
from typing import Any, List, Mapping, Tuple

import sentry_sdk
from sentry_sdk import set_tag, set_user

from sentry import features
from sentry.db.models.fields.node import NodeData
from sentry.integrations.utils.code_mapping import CodeMapping, CodeMappingTreesHelper
from sentry.models import Project
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.tasks.base import instrumented_task
from sentry.utils.json import JSONData
from sentry.utils.safe import get_path

ACTIVE_PROJECT_THRESHOLD = timedelta(days=7)
GROUP_ANALYSIS_RANGE = timedelta(days=14)

logger = logging.getLogger("sentry.tasks.derive_code_mappings")


@instrumented_task(  # type: ignore
    name="sentry.tasks.derive_code_mappings.derive_code_mappings",
    queue="derive_code_mappings",
    max_retries=0,  # if we don't backfill it this time, we'll get it the next time
)
def derive_code_mappings(
    project_id: int,
    data: NodeData,
    dry_run=False,
) -> None:
    """
    Derive code mappings for a project given data from a recent event.

    This task is queued at most once per hour per project, based on the ingested events.
    """
    project = Project.objects.get(id=project_id)
    organization: Organization = Organization.objects.get(id=project.organization_id)
    set_tag("organization.slug", organization.slug)
    # When you look at the performance page the user is a default column
    set_user({"username": organization.slug})

    # Check the feature flag again to ensure the feature is still enabled.
    if not features.has("organizations:derive-code-mappings", organization):
        return

    stacktrace_paths: List[str] = identify_stacktrace_paths(data)
    if not stacktrace_paths:
        return

    installation, organization_integration = get_installation(organization)
    if not installation:
        return

    trees: JSONData = installation.get_trees_for_org()
    trees_helper = CodeMappingTreesHelper(trees)
    code_mappings = trees_helper.generate_code_mappings(stacktrace_paths)
    if dry_run:
        set_tag("project.slug", project.slug)
        sentry_sdk.capture_message(
            f"Dry run {project.slug=}: would create these code mapping based on {stacktrace_paths=}: {code_mappings}"
        )
        return

    set_project_codemappings(code_mappings, organization_integration, project)


def identify_stacktrace_paths(data: NodeData) -> List[str]:
    """
    Get the stacktrace_paths from the event data.
    """
    if data["platform"] != "python":
        return []
    stacktraces = get_stacktrace(data)
    stacktrace_paths = set()
    for stacktrace in stacktraces:
        try:
            paths = {frame["filename"] for frame in stacktrace["frames"]}
            stacktrace_paths.update(paths)
        except Exception:
            logger.exception("Error getting filenames for project {project.slug}")
    return list(stacktrace_paths)


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
    organization_integration: OrganizationIntegration,
    project: Project,
) -> None:
    """
    Given a list of code mappings, create a new repository project path
    config for each mapping.
    """
    organization_id = organization_integration.organization_id
    for code_mapping in code_mappings:
        repository, _ = Repository.objects.get_or_create(
            name=code_mapping.repo.name,
            organization_id=organization_id,
            defaults={
                "name": code_mapping.repo.name,
                "organization_id": organization_id,
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

import logging
from typing import Any, List, Mapping, Tuple

from sentry_sdk import set_tag, set_user

from sentry import features
from sentry.db.models.fields.node import NodeData
from sentry.integrations.utils.code_mapping import CodeMapping, CodeMappingTreesHelper
from sentry.locks import locks
from sentry.models import Project
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.tasks.base import instrumented_task
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.safe import get_path

SUPPORTED_LANGUAGES = ["javascript", "python"]

logger = logging.getLogger(__name__)


@instrumented_task(  # type: ignore
    name="sentry.tasks.derive_code_mappings.derive_code_mappings",
    queue="derive_code_mappings",
    default_retry_delay=60 * 10,
    autoretry_for=(UnableToAcquireLock,),
    max_retries=3,
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
    org: Organization = Organization.objects.get(id=project.organization_id)
    set_tag("organization.slug", org.slug)
    # When you look at the performance page the user is a default column
    set_user({"username": org.slug})
    set_tag("project.slug", project.slug)
    extra = {
        "organization.slug": org.slug,
    }
    feat_key = "organizations:derive-code-mappings"
    # Check the feature flag again to ensure the feature is still enabled.
    should_continue = features.has(feat_key, org) or features.has(f"{feat_key}-dry-run", org)

    if not (dry_run or should_continue or data["platform"] not in SUPPORTED_LANGUAGES):
        logger.info("Event should not be processed.", extra=extra)
        return

    stacktrace_paths: List[str] = identify_stacktrace_paths(data)
    if not stacktrace_paths:
        return

    installation, organization_integration = get_installation(org)
    if not installation:
        return

    trees = {}
    # Acquire the lock for a maximum of 10 minutes
    lock = locks.get(key=f"get_trees_for_org:{org.slug}", duration=60 * 10, name="process_pending")

    try:
        with lock.acquire():
            trees = installation.get_trees_for_org()
    except UnableToAcquireLock as error:
        extra["error"] = error
        logger.warning("derive_code_mappings.getting_lock_failed", extra=extra)
        # This will cause the auto-retry logic to try again
        raise error

    trees_helper = CodeMappingTreesHelper(trees)
    code_mappings = trees_helper.generate_code_mappings(stacktrace_paths)
    if dry_run:
        report_project_codemappings(code_mappings, stacktrace_paths, project)
        return

    set_project_codemappings(code_mappings, organization_integration, project)


def identify_stacktrace_paths(data: NodeData) -> List[str]:
    """
    Get the stacktrace_paths from the event data.
    """
    stacktraces = get_stacktrace(data)
    stacktrace_paths = set()
    for stacktrace in stacktraces:
        try:
            frames = stacktrace["frames"]
            paths = {
                frame["filename"]
                for frame in frames
                if frame.get("in_app") and frame.get("filename")
            }
            stacktrace_paths.update(paths)
        except Exception:
            logger.exception("Error getting filenames for project.")
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

        cm, created = RepositoryProjectPathConfig.objects.get_or_create(
            project=project,
            stack_root=code_mapping.stacktrace_root,
            defaults={
                "repository": repository,
                "organization_integration": organization_integration,
                "source_root": code_mapping.source_path,
                "default_branch": code_mapping.repo.branch,
                "automatically_generated": True,
            },
        )
        if not created:
            logger.info(
                "derive_code_mappings: code mapping already exists",
                extra={
                    "project": project,
                    "stacktrace_root": code_mapping.stacktrace_root,
                    "new_code_mapping": code_mapping,
                    "existing_code_mapping": cm,
                },
            )


def report_project_codemappings(
    code_mappings: List[CodeMapping],
    stacktrace_paths: List[str],
    project: Project,
) -> None:
    """
    Log the code mappings that would be created for a project.
    """
    extra = {
        "org": project.organization.slug,
        "project": project.slug,
        "code_mappings": code_mappings,
        "stacktrace_paths": stacktrace_paths,
    }
    if code_mappings:
        msg = "derive_code_mappings: code mappings would have been created."
    else:
        msg = "derive_code_mappings: NO code mappings would have been created."
    existing_code_mappings = RepositoryProjectPathConfig.objects.filter(project=project)
    if existing_code_mappings.exists():
        msg = "derive_code_mappings: code mappings already exist."
        extra["existing_code_mappings"] = existing_code_mappings

    logger.info(msg, extra=extra)

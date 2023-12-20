from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, List, Mapping, Tuple

from sentry_sdk import set_tag, set_user

from sentry import features
from sentry.constants import ObjectStatus
from sentry.db.models.fields.node import NodeData
from sentry.integrations.utils.code_mapping import CodeMapping, CodeMappingTreesHelper
from sentry.locks import locks
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import RpcOrganizationIntegration, integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.base import instrumented_task
from sentry.utils.json import JSONData
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.safe import get_path

SUPPORTED_LANGUAGES = ["javascript", "python", "node", "ruby"]

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.integrations.base import IntegrationInstallation


def process_error(error: ApiError, extra: Dict[str, str]) -> None:
    """Log known issues and report unknown ones"""
    msg = error.text
    if error.json:
        json_data: JSONData = error.json
        msg = json_data.get("message")
    extra["error"] = msg

    if msg == "Not Found":
        logger.warning("The org has uninstalled the Sentry App.", extra=extra)
        return
    elif msg == "This installation has been suspended":
        logger.warning("The org has suspended the Sentry App.", extra=extra)
        return
    elif msg == "Server Error":
        logger.warning("Github failed to respond.", extra=extra)
        return
    elif msg.startswith("Although you appear to have the correct authorization credentials"):
        # Although you appear to have the correct authorization credentials, the
        # <github_org_here> organization has an IP allow list enabled, and
        # <ip_address_here> is not permitted to access this resource.
        logger.warning("The org has suspended the Sentry App. See code comment.", extra=extra)
        return
    elif msg.startswith("Due to U.S. trade controls law restrictions, this GitHub"):
        logger.warning("Github has blocked this org. We will not continue.", extra=extra)
        return

    # Logging the exception and returning is better than re-raising the error
    # Otherwise, API errors would not group them since the HTTPError in the stack
    # has unique URLs, thus, separating the errors
    logger.error(
        "Unhandled ApiError occurred. Nothing is broken. Investigate. Multiple issues grouped.",
        extra=extra,
    )


@instrumented_task(
    name="sentry.tasks.derive_code_mappings.derive_code_mappings",
    queue="derive_code_mappings",
    default_retry_delay=60 * 10,
    autoretry_for=(UnableToAcquireLock,),
    max_retries=3,
)
def derive_code_mappings(
    project_id: int,
    data: NodeData,
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
    extra: Dict[str, Any] = {
        "organization.slug": org.slug,
    }

    if (
        not features.has("organizations:derive-code-mappings", org)
        or not data["platform"] in SUPPORTED_LANGUAGES
    ):
        logger.info("Event should not be processed.", extra=extra)
        return

    stacktrace_paths: List[str] = identify_stacktrace_paths(data)
    if not stacktrace_paths:
        return

    installation, organization_integration = get_installation(org)
    if not installation or not organization_integration:
        return

    trees = {}
    # Acquire the lock for a maximum of 10 minutes
    lock = locks.get(key=f"get_trees_for_org:{org.slug}", duration=60 * 10, name="process_pending")

    try:
        with lock.acquire():
            # This method is specific to the GithubIntegration
            trees = installation.get_trees_for_org()  # type: ignore
    except ApiError as error:
        process_error(error, extra)
        return
    except UnableToAcquireLock as error:
        extra["error"] = error
        logger.warning("derive_code_mappings.getting_lock_failed", extra=extra)
        # This will cause the auto-retry logic to try again
        raise error
    except Exception:
        logger.exception("Unexpected error type while calling `get_trees_for_org()`.", extra=extra)
        return

    if not trees:
        logger.warning("The trees are empty.")
        return

    trees_helper = CodeMappingTreesHelper(trees)
    code_mappings = trees_helper.generate_code_mappings(stacktrace_paths)
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
                if frame and frame.get("in_app") and frame.get("filename")
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


def get_installation(
    organization: Organization,
) -> Tuple[IntegrationInstallation | None, RpcOrganizationIntegration | None]:
    integrations = integration_service.get_integrations(
        organization_id=organization.id,
        providers=["github"],
        status=ObjectStatus.ACTIVE,
    )
    if len(integrations) == 0:
        return None, None

    # XXX: We only operate on the first github integration for an organization.
    integration = integrations[0]
    organization_integration = integration_service.get_organization_integration(
        integration_id=integration.id, organization_id=organization.id
    )
    if not organization_integration:
        return None, None

    installation = integration.get_installation(organization_id=organization.id)

    return installation, organization_integration


def set_project_codemappings(
    code_mappings: List[CodeMapping],
    organization_integration: RpcOrganizationIntegration,
    project: Project,
) -> None:
    """
    Given a list of code mappings, create a new repository project path
    config for each mapping.
    """
    organization_id = organization_integration.organization_id
    for code_mapping in code_mappings:
        repository = (
            Repository.objects.filter(name=code_mapping.repo.name, organization_id=organization_id)
            .order_by("-date_added")
            .first()
        )

        if not repository:
            repository = Repository.objects.create(
                name=code_mapping.repo.name,
                organization_id=organization_id,
                integration_id=organization_integration.integration_id,
            )

        cm, created = RepositoryProjectPathConfig.objects.get_or_create(
            project=project,
            stack_root=code_mapping.stacktrace_root,
            defaults={
                "repository": repository,
                "organization_integration_id": organization_integration.id,
                "integration_id": organization_integration.integration_id,
                "organization_id": organization_integration.organization_id,
                "source_root": code_mapping.source_path,
                "default_branch": code_mapping.repo.branch,
                "automatically_generated": True,
            },
        )
        if not created:
            logger.info(
                "Code mapping already exists",
                extra={
                    "project": project,
                    "stacktrace_root": code_mapping.stacktrace_root,
                    "new_code_mapping": code_mapping,
                    "existing_code_mapping": cm,
                },
            )

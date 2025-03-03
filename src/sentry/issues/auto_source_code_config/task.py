from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from sentry_sdk import set_tag, set_user

from sentry import eventstore
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.issues.auto_source_code_config.code_mapping import (
    CodeMapping,
    CodeMappingTreesHelper,
    FailedToExtractFilename,
    MissingModuleOrAbsPath,
)
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

from .integration_utils import (
    InstallationCannotGetTreesError,
    InstallationNotFoundError,
    get_installation,
)
from .stacktraces import get_frames_to_process
from .utils import is_dry_run_platform, supported_platform

logger = logging.getLogger(__name__)


class DeriveCodeMappingsErrorReason(StrEnum):
    UNEXPECTED_ERROR = "Unexpected error type while calling `get_trees_for_org()`."
    LOCK_FAILED = "Failed to acquire lock"
    EMPTY_TREES = "The trees are empty."


def process_event(project_id: int, group_id: int, event_id: str) -> list[CodeMapping]:
    """
    Process errors for customers with source code management installed and calculate code mappings
    among other things.

    This task is queued at most once per hour per project.
    """
    project = Project.objects.get(id=project_id)
    org = Organization.objects.get(id=project.organization_id)
    set_tag("organization.slug", org.slug)
    # When you look at the performance page the user is a default column
    set_user({"username": org.slug})
    set_tag("project.slug", project.slug)
    extra = {
        "organization.slug": org.slug,
        "project_id": project_id,
        "group_id": group_id,
        "event_id": event_id,
    }

    event = eventstore.backend.get_event_by_id(project_id, event_id, group_id)
    if event is None:
        logger.error("Event not found.", extra=extra)
        return []

    platform = event.platform
    assert platform is not None
    if not supported_platform(platform):
        return []

    frames_to_process = get_frames_to_process(event.data, platform)
    if not frames_to_process:
        return []

    code_mappings = []
    try:
        installation = get_installation(org)
        trees = get_trees_for_org(installation, org, extra)
        trees_helper = CodeMappingTreesHelper(trees)
        code_mappings = trees_helper.generate_code_mappings(frames_to_process, platform)
        if not is_dry_run_platform(platform):
            set_project_codemappings(code_mappings, installation, project, platform)
    except (InstallationNotFoundError, InstallationCannotGetTreesError):
        pass
    except (FailedToExtractFilename, MissingModuleOrAbsPath):
        logger.warning("Non-urgent error. Investigate.", extra=extra)

    return code_mappings


def process_error(error: ApiError, extra: dict[str, Any]) -> None:
    """Log known issues and report unknown ones"""
    if error.json:
        json_data: Any = error.json
        msg = json_data.get("message")
    else:
        msg = error.text
    extra["error"] = msg

    if msg is None:
        logger.warning("No message found in ApiError.", extra=extra)
        return
    elif msg == "Not Found":
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


def get_trees_for_org(
    installation: IntegrationInstallation, org: Organization, extra: dict[str, Any]
) -> dict[str, Any]:
    trees: dict[str, Any] = {}
    if not hasattr(installation, "get_trees_for_org"):
        return trees

    # Acquire the lock for a maximum of 10 minutes
    lock = locks.get(key=f"get_trees_for_org:{org.slug}", duration=60 * 10, name="process_pending")

    with SCMIntegrationInteractionEvent(
        SCMIntegrationInteractionType.DERIVE_CODEMAPPINGS,
        provider_key=installation.model.provider,
    ).capture() as lifecycle:
        try:
            with lock.acquire():
                trees = installation.get_trees_for_org()
                if not trees:
                    lifecycle.record_halt(DeriveCodeMappingsErrorReason.EMPTY_TREES, extra=extra)
        except ApiError as error:
            process_error(error, extra)
            lifecycle.record_halt(error, extra)
        except UnableToAcquireLock as error:
            lifecycle.record_halt(error, extra)
        except Exception:
            lifecycle.record_failure(DeriveCodeMappingsErrorReason.UNEXPECTED_ERROR, extra=extra)

        return trees


def set_project_codemappings(
    code_mappings: list[CodeMapping],
    installation: IntegrationInstallation,
    project: Project,
    platform: str,
) -> None:
    """
    Given a list of code mappings, create a new repository project path
    config for each mapping.
    """
    organization_integration = installation.org_integration
    if not organization_integration:
        raise InstallationNotFoundError

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

        _, created = RepositoryProjectPathConfig.objects.get_or_create(
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
        if created:
            metrics.incr("code_mappings.created", tags={"platform": platform})

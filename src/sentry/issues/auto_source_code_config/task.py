from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import StrEnum
from typing import Any

from sentry_sdk import set_tag, set_user

from sentry import eventstore
from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.issues.auto_source_code_config.code_mapping import CodeMapping, CodeMappingTreesHelper
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

from .constants import METRIC_PREFIX
from .in_app_stack_trace_rules import save_in_app_stack_trace_rules
from .integration_utils import (
    InstallationCannotGetTreesError,
    InstallationNotFoundError,
    get_installation,
)
from .stacktraces import get_frames_to_process
from .utils.platform import PlatformConfig
from .utils.repository import create_repository

logger = logging.getLogger(__name__)


class DeriveCodeMappingsErrorReason(StrEnum):
    UNEXPECTED_ERROR = "Unexpected error type while calling `get_trees_for_org()`."
    LOCK_FAILED = "Failed to acquire lock"
    EMPTY_TREES = "The trees are empty."


def process_event(
    project_id: int, group_id: int, event_id: str
) -> tuple[list[CodeMapping], list[str]]:
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

    event = fetch_event(project_id, event_id, group_id, extra)
    if event is None:
        return [], []

    platform = event.platform
    assert platform is not None
    set_tag("platform", platform)

    platform_config = PlatformConfig(platform)
    if not platform_config.is_supported():
        return [], []

    frames_to_process = get_frames_to_process(event.data, platform)
    if not frames_to_process:
        return [], []

    code_mappings: list[CodeMapping] = []
    in_app_stack_trace_rules: list[str] = []
    try:
        installation = get_installation(org)
        trees = get_trees_for_org(installation, org, extra)
        trees_helper = CodeMappingTreesHelper(trees)
        code_mappings = trees_helper.generate_code_mappings(frames_to_process, platform)
        _, in_app_stack_trace_rules = create_configurations(
            code_mappings, installation, project, platform_config
        )

    except (InstallationNotFoundError, InstallationCannotGetTreesError):
        pass

    return code_mappings, in_app_stack_trace_rules


def fetch_event(
    project_id: int, event_id: str, group_id: int, extra: dict[str, Any]
) -> GroupEvent | Event | None:
    event: GroupEvent | Event | None = None
    try:
        event = eventstore.backend.get_event_by_id(project_id, event_id, group_id)
        if event is None:
            metrics.incr(
                key=f"{METRIC_PREFIX}.failure", tags={"reason": "event_not_found"}, sample_rate=1.0
            )
    except Exception:
        logger.exception("Error fetching event.", extra=extra)
        metrics.incr(
            key=f"{METRIC_PREFIX}.failure",
            tags={"reason": "event_fetching_exception"},
            sample_rate=1.0,
        )
    return event


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

    # Logging the warning and returning is better than re-raising the error
    # Otherwise, API errors would not group them since the HTTPError in the stack
    # has unique URLs, thus, separating the errors
    logger.warning("Unhandled ApiError occurred. Multiple issues grouped.", extra=extra)


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


def create_configurations(
    code_mappings: list[CodeMapping],
    installation: IntegrationInstallation,
    project: Project,
    platform_config: PlatformConfig,
) -> tuple[list[CodeMapping], list[str]]:
    """
    Given a set of trees and frames to process, create code mappings & in-app stack trace rules.

    Returns a tuple of code mappings and in-app stack trace rules even when running in dry-run mode.
    """
    org_integration = installation.org_integration
    if not org_integration:
        raise InstallationNotFoundError

    dry_run = platform_config.is_dry_run_platform(project.organization)
    platform = platform_config.platform
    tags: Mapping[str, str | bool] = {"platform": platform, "dry_run": dry_run}
    with metrics.timer(f"{METRIC_PREFIX}.create_configurations.duration", tags=tags):
        for code_mapping in code_mappings:
            repository = create_repository(code_mapping.repo.name, org_integration, tags)
            create_code_mapping(code_mapping, repository, project, org_integration, tags)

    in_app_stack_trace_rules: list[str] = []
    if platform_config.creates_in_app_stack_trace_rules():
        in_app_stack_trace_rules = save_in_app_stack_trace_rules(
            project, code_mappings, platform_config
        )

    # We return this to allow tests running in dry-run mode to assert
    # what would have been created.
    return code_mappings, in_app_stack_trace_rules


def create_code_mapping(
    code_mapping: CodeMapping,
    repository: Repository | None,
    project: Project,
    org_integration: RpcOrganizationIntegration,
    tags: Mapping[str, str | bool],
) -> None:
    created = False
    if not tags["dry_run"] and repository is not None:
        _, created = RepositoryProjectPathConfig.objects.get_or_create(
            project=project,
            stack_root=code_mapping.stacktrace_root,
            defaults={
                "repository": repository,
                "organization_integration_id": org_integration.id,
                "integration_id": org_integration.integration_id,
                "organization_id": org_integration.organization_id,
                "source_root": code_mapping.source_path,
                "default_branch": code_mapping.repo.branch,
                "automatically_generated": True,
            },
        )
    if created or tags["dry_run"]:
        metrics.incr(key=f"{METRIC_PREFIX}.code_mapping.created", tags=tags, sample_rate=1.0)

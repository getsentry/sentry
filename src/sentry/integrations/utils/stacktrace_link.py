from __future__ import annotations

import logging
from typing import TYPE_CHECKING, NotRequired, TypedDict

from sentry.constants import ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.issues.auto_source_code_config.code_mapping import (
    convert_stacktrace_frame_path_to_source_path,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.event_frames import EventFrame

if TYPE_CHECKING:
    from sentry.issues.endpoints.project_stacktrace_link import StacktraceLinkContext

logger = logging.getLogger(__name__)


class RepositoryLinkOutcome(TypedDict):
    sourceUrl: NotRequired[str]
    error: NotRequired[str]
    attemptedUrl: NotRequired[str]
    sourcePath: NotRequired[str]


def get_link(
    config: RepositoryProjectPathConfig, src_path: str, version: str | None = None
) -> RepositoryLinkOutcome:
    result: RepositoryLinkOutcome = {}

    integration = integration_service.get_integration(
        organization_integration_id=config.organization_integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        result["error"] = "integration_not_found"
        return result

    install = integration.get_installation(organization_id=config.project.organization_id)

    link = None
    try:
        if isinstance(install, RepositoryIntegration):
            link = install.get_stacktrace_link(
                config.repository, src_path, str(config.default_branch or ""), version
            )
    except ApiError as e:
        if e.code != 403:
            raise
        result["error"] = "integration_link_forbidden"

    # If the link was not found, attach the URL that we attempted.
    if link:
        result["sourceUrl"] = link
    else:
        result["error"] = result.get("error") or "file_not_found"
        assert isinstance(install, RepositoryIntegration)
        result["attemptedUrl"] = install.format_source_url(
            config.repository, src_path, str(config.default_branch or "")
        )
    result["sourcePath"] = src_path

    return result


class StacktraceLinkConfig(TypedDict):
    config: RepositoryProjectPathConfig
    outcome: RepositoryLinkOutcome
    repository: Repository


class StacktraceLinkOutcome(TypedDict):
    source_url: str | None
    error: str | None
    src_path: str | None
    current_config: StacktraceLinkConfig | None
    iteration_count: int


def get_stacktrace_config(
    configs: list[RepositoryProjectPathConfig],
    ctx: StacktraceLinkContext,
) -> StacktraceLinkOutcome:
    result: StacktraceLinkOutcome = {
        "source_url": None,
        "error": None,
        "src_path": None,
        "current_config": None,
        "iteration_count": 0,
    }
    for config in configs:
        src_path = convert_stacktrace_frame_path_to_source_path(
            frame=EventFrame.from_dict(ctx),
            platform=ctx["platform"],
            sdk_name=ctx["sdk_name"],
            code_mapping=config,
        )
        result["src_path"] = src_path
        if not src_path:
            result["error"] = "stack_root_mismatch"
            continue

        outcome = get_link(config, src_path, ctx["commit_id"])
        result["iteration_count"] += 1

        result["current_config"] = {
            "config": config,
            "outcome": outcome,
            "repository": config.repository,
        }

        # Stop processing if a match is found
        if outcome.get("sourceUrl") and outcome["sourceUrl"]:
            result["source_url"] = outcome["sourceUrl"]
            return result

    return result

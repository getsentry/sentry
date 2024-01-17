from __future__ import annotations

import logging
from typing import Dict, List, Mapping, Optional, TypedDict

from typing_extensions import NotRequired

from sentry import analytics
from sentry.api.utils import Timer
from sentry.integrations.mixins import RepositoryMixin
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.event_frames import munged_filename_and_frames

logger = logging.getLogger(__name__)


class ReposityLinkOutcome(TypedDict):
    sourceUrl: NotRequired[str]
    error: NotRequired[str]
    attemptedUrl: NotRequired[str]
    sourcePath: NotRequired[str]


def get_link(
    config: RepositoryProjectPathConfig,
    filepath: str,
    version: Optional[str] = None,
    group_id: Optional[str] = None,
    frame_abs_path: Optional[str] = None,
) -> ReposityLinkOutcome:
    result: ReposityLinkOutcome = {}

    integration = integration_service.get_integration(
        organization_integration_id=config.organization_integration_id
    )
    if not integration:
        result["error"] = "integration_not_found"
        return result

    install = integration.get_installation(organization_id=config.project.organization_id)

    formatted_path = filepath.replace(config.stack_root, config.source_root, 1)

    link = None
    try:
        if isinstance(install, RepositoryMixin):
            with Timer() as t:
                link = install.get_stacktrace_link(
                    config.repository, formatted_path, str(config.default_branch or ""), version
                )
                analytics.record(
                    "function_timer.timed",
                    function_name="get_stacktrace_link",
                    duration=t.duration,
                    organization_id=config.project.organization_id,
                    project_id=config.project_id,
                    group_id=group_id,
                    frame_abs_path=frame_abs_path,
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
        assert isinstance(install, RepositoryMixin)
        result["attemptedUrl"] = install.format_source_url(
            config.repository, formatted_path, str(config.default_branch or "")
        )
    result["sourcePath"] = formatted_path

    return result


def try_path_munging(
    config: RepositoryProjectPathConfig,
    filepath: str,
    ctx: Mapping[str, Optional[str]],
    current_iteration_count: int,
) -> tuple[ReposityLinkOutcome, int]:
    result: ReposityLinkOutcome = {}
    munged_frames = munged_filename_and_frames(
        str(ctx["platform"]), [ctx], "munged_filename", sdk_name=str(ctx["sdk_name"])
    )
    if munged_frames:
        munged_frame: Mapping[str, Mapping[str, str]] = munged_frames[1][0]
        munged_filename = str(munged_frame.get("munged_filename"))
        if munged_filename:
            if not filepath.startswith(config.stack_root) and not munged_filename.startswith(
                config.stack_root
            ):
                result = {"error": "stack_root_mismatch"}
            else:
                result = get_link(
                    config,
                    munged_filename,
                    ctx.get("commit_id"),
                    ctx.get("group_id"),
                    ctx.get("abs_path"),
                )

                current_iteration_count += 1

    return result, current_iteration_count


class StacktraceLinkConfig(TypedDict):
    config: RepositoryProjectPathConfig
    outcome: ReposityLinkOutcome
    repository: Repository


class StacktraceLinkOutcome(TypedDict):
    source_url: str | None
    error: str | None
    current_config: StacktraceLinkConfig | None
    iteration_count: int
    is_munged: bool


def get_stacktrace_config(
    configs: List[RepositoryProjectPathConfig],
    ctx: Dict[str, Optional[str]],
) -> StacktraceLinkOutcome:
    filepath = str(ctx.get("file", ""))
    result: StacktraceLinkOutcome = {
        "source_url": None,
        "error": None,
        "current_config": None,
        "iteration_count": 0,
        "is_munged": False,
    }
    for config in configs:
        outcome: ReposityLinkOutcome = {}
        munging_outcome: ReposityLinkOutcome = {}

        # Munging is required for get_link to work with mobile platforms
        if ctx["platform"] in ["java", "cocoa", "other"]:
            munging_outcome, next_iteration_count = try_path_munging(
                config, filepath, ctx, result["iteration_count"]
            )
            result["iteration_count"] = next_iteration_count
            if munging_outcome.get("error") == "stack_root_mismatch":
                result["error"] = "stack_root_mismatch"
                continue

        if not munging_outcome:
            if not filepath.startswith(config.stack_root):
                # This may be overwritten if a valid code mapping is found
                result["error"] = "stack_root_mismatch"
                continue

            outcome = get_link(
                config,
                filepath,
                ctx.get("commit_id"),
                ctx.get("group_id"),
                ctx.get("abs_path"),
            )
            result["iteration_count"] += 1
            # XXX: I want to remove this whole block logic as I believe it is wrong
            # In some cases the stack root matches and it can either be that we have
            # an invalid code mapping or that munging is expect it to work
            if not outcome.get("sourceUrl"):
                munging_outcome, next_iteration_count = try_path_munging(
                    config, filepath, ctx, result["iteration_count"]
                )
                result["iteration_count"] = next_iteration_count
                if munging_outcome:
                    # Report errors to Sentry for investigation
                    logger.error("We should never be able to reach this code.")

        # Keep the original outcome if munging failed
        if munging_outcome:
            outcome = munging_outcome
            result["is_munged"] = True

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

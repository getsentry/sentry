from __future__ import annotations

import logging
from typing import Dict, Mapping, Optional

from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope, configure_scope

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import IntegrationSerializer, serialize
from sentry.api.utils import Timer
from sentry.integrations import IntegrationFeatures
from sentry.integrations.mixins import RepositoryMixin
from sentry.integrations.utils.code_mapping import (
    convert_stacktrace_frame_path_to_source_path,
    get_sorted_code_mapping_configs,
)
from sentry.integrations.utils.codecov import codecov_enabled, fetch_codecov_data
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.event_frames import EventFrame
from sentry.utils.json import JSONData

logger = logging.getLogger(__name__)


def get_link(
    config: RepositoryProjectPathConfig,
    src_path: str,
    version: Optional[str] = None,
    group_id: Optional[str] = None,
    frame_abs_path: Optional[str] = None,
) -> Dict[str, str]:
    result = {}

    integration = integration_service.get_integration(
        organization_integration_id=config.organization_integration_id
    )
    install = integration.get_installation(organization_id=config.project.organization_id)

    link = None
    try:
        if isinstance(install, RepositoryMixin):
            with Timer() as t:
                link = install.get_stacktrace_link(
                    config.repository, src_path, config.default_branch, version
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
            config.repository, src_path, config.default_branch
        )
    result["sourcePath"] = src_path

    return result


def generate_context(parameters: Dict[str, Optional[str]]) -> Dict[str, Optional[str]]:
    return {
        "file": parameters.get("file"),
        # XXX: Temp change to support try_path_munging until refactored
        "filename": parameters.get("file"),
        "commit_id": parameters.get("commitId"),
        "platform": parameters.get("platform"),
        "sdk_name": parameters.get("sdkName"),
        "abs_path": parameters.get("absPath"),
        "module": parameters.get("module"),
        "package": parameters.get("package"),
        "line_no": parameters.get("lineNo"),
        "group_id": parameters.get("groupId"),
    }


def set_top_tags(
    scope: Scope,
    project: Project,
    ctx: Mapping[str, Optional[str]],
    has_code_mappings: bool,
) -> None:
    try:
        scope.set_tag("project.slug", project.slug)
        scope.set_tag("organization.slug", project.organization.slug)
        scope.set_tag(
            "organization.early_adopter", bool(project.organization.flags.early_adopter.is_set)
        )
        scope.set_tag("stacktrace_link.platform", ctx["platform"])
        scope.set_tag("stacktrace_link.code_mappings", has_code_mappings)
        scope.set_tag("stacktrace_link.file", ctx["file"])
        # Add tag if filepath is Windows
        if ctx["file"] and ctx["file"].find(":\\") > -1:
            scope.set_tag("stacktrace_link.windows", True)
        scope.set_tag("stacktrace_link.abs_path", ctx["abs_path"])
        if ctx["platform"] == "python":
            # This allows detecting a file that belongs to Python's 3rd party modules
            scope.set_tag("stacktrace_link.in_app", "site-packages" not in str(ctx["abs_path"]))
    except Exception:
        # If errors arises we can still proceed
        logger.exception("We failed to set a tag.")


def set_tags(scope: Scope, result: JSONData) -> None:
    scope.set_tag("stacktrace_link.found", result["sourceUrl"] is not None)
    scope.set_tag("stacktrace_link.source_url", result.get("sourceUrl"))
    scope.set_tag("stacktrace_link.error", result.get("error"))
    scope.set_tag("stacktrace_link.tried_url", result.get("attemptedUrl"))
    if result["config"]:
        scope.set_tag("stacktrace_link.empty_root", result["config"]["stackRoot"] == "")
        scope.set_tag(
            "stacktrace_link.auto_derived", result["config"]["automaticallyGenerated"] is True
        )
    scope.set_tag("stacktrace_link.has_integration", len(result["integrations"]) > 0)


@region_silo_endpoint
class ProjectStacktraceLinkEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    """
    Returns valid links for source code providers so that
    users can go from the file in the stack trace to the
    provider of their choice.

    `file`: The file path from the stack trace
    `commitId` (optional): The commit_id for the last commit of the
                           release associated to the stack trace's event
    `sdkName` (optional): The sdk.name associated with the event
    `absPath` (optional): The abs_path field value of the relevant stack frame
    `module`   (optional): The module field value of the relevant stack frame
    `package`  (optional): The package field value of the relevant stack frame
    `groupId`   (optional): The Issue's id.
    """

    owner = ApiOwner.ISSUES

    def get(self, request: Request, project: Project) -> Response:
        ctx = generate_context(request.GET)
        filepath = ctx.get("file")
        if not filepath:
            return Response({"detail": "Filepath is required"}, status=400)

        result: JSONData = {"config": None, "sourceUrl": None}

        integrations = integration_service.get_integrations(organization_id=project.organization_id)
        # TODO(meredith): should use get_provider.has_feature() instead once this is
        # no longer feature gated and is added as an IntegrationFeature
        serializer = IntegrationSerializer()
        result["integrations"] = [
            serialize(i, request.user, serializer)
            for i in integrations
            if i.has_feature(IntegrationFeatures.STACKTRACE_LINK)
        ]

        configs = get_sorted_code_mapping_configs(project)

        current_config = None
        iteration_count = 0

        with configure_scope() as scope:
            set_top_tags(scope, project, ctx, len(configs) > 0)
            for config in configs:
                src_path = convert_stacktrace_frame_path_to_source_path(
                    frame=EventFrame.from_dict(ctx),
                    platform=ctx["platform"],
                    sdk_name=ctx["sdk_name"],
                    code_mapping=config,
                )

                if not src_path:
                    result["error"] = "stack_root_mismatch"
                    continue

                outcome = get_link(
                    config, src_path, ctx["commit_id"], ctx["group_id"], ctx["abs_path"]
                )
                iteration_count += 1

                current_config = {
                    "config": serialize(config, request.user),
                    "outcome": outcome,
                    "repository": config.repository,
                }

                # Use the provider key to split up stacktrace-link metrics by integration type
                provider = current_config["config"]["provider"]["key"]
                scope.set_tag("integration_provider", provider)  # e.g. github

                # Stop processing if a match is found
                if outcome.get("sourceUrl") and outcome["sourceUrl"]:
                    result["sourceUrl"] = outcome["sourceUrl"]
                    break

            # Post-processing before exiting scope context
            if current_config:
                result["config"] = current_config["config"]
                if not result.get("sourceUrl"):
                    result["error"] = current_config["outcome"]["error"]
                    # When no code mapping have been matched we have not attempted a URL
                    if current_config["outcome"].get("attemptedUrl"):
                        result["attemptedUrl"] = current_config["outcome"]["attemptedUrl"]

                should_get_coverage = codecov_enabled(project.organization)
                scope.set_tag("codecov.enabled", should_get_coverage)
                if should_get_coverage:
                    with Timer() as t:
                        codecov_data = fetch_codecov_data(config=current_config)
                        analytics.record(
                            "function_timer.timed",
                            function_name="fetch_codecov_data",
                            duration=t.duration,
                            organization_id=project.organization_id,
                            project_id=project.id,
                            group_id=ctx.get("group_id"),
                            frame_abs_path=ctx.get("abs_path"),
                        )
                    if codecov_data:
                        result["codecov"] = codecov_data
            try:
                set_tags(scope, result)
            except Exception:
                logger.exception("Failed to set tags.")

        if result["config"]:
            analytics.record(
                "integration.stacktrace.linked",
                provider=result["config"]["provider"]["key"],
                config_id=result["config"]["id"],
                project_id=project.id,
                organization_id=project.organization_id,
                filepath=filepath,
                status=result.get("error") or "success",
                link_fetch_iterations=iteration_count,
            )

        return Response(result)

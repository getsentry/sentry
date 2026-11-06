from __future__ import annotations

import logging
from collections.abc import Collection
from typing import Any, TypedDict

from django.http import QueryDict
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.analytics import IntegrationStacktraceLinkEvent
from sentry.integrations.api.serializers.models.integration import (
    IntegrationSerializer,
    IntegrationSerializerResponse,
)
from sentry.integrations.api.serializers.models.repository_project_path_config import (
    RepositoryProjectPathConfigSerializerResponse,
)
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.services.integration import integration_service
from sentry.integrations.utils.stacktrace_link import StacktraceLinkOutcome, get_stacktrace_config
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.models.project import Project

logger = logging.getLogger(__name__)


class StacktraceLinkContext(TypedDict):
    file: str
    filename: str
    platform: str | None
    abs_path: str | None
    commit_id: str | None
    group_id: str | None
    line_no: str | None
    module: str | None
    package: str | None
    sdk_name: str | None


class StacktraceLinkResponseOptional(TypedDict, total=False):
    sourcePath: str | None
    attemptedUrl: str | None


class StacktraceLinkResponse(StacktraceLinkResponseOptional):
    error: str | None
    config: RepositoryProjectPathConfigSerializerResponse | None
    sourceUrl: str | None
    integrations: list[IntegrationSerializerResponse]


def generate_context(parameters: QueryDict) -> StacktraceLinkContext:
    return {
        "file": parameters.get("file", ""),
        # XXX: Temp change to support try_path_munging until refactored
        "filename": parameters.get("file", ""),
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
    ctx: StacktraceLinkContext,
    has_code_mappings: bool,
) -> None:
    try:
        scope.set_tag("project.slug", project.slug)
        scope.set_attribute("project.slug", project.slug)
        scope.set_tag("organization.slug", project.organization.slug)
        scope.set_attribute("organization.slug", project.organization.slug)
        scope.set_tag("organization.early_adopter", bool(project.organization.flags.early_adopter))
        scope.set_attribute(
            "organization.early_adopter", bool(project.organization.flags.early_adopter)
        )

        platform = ctx["platform"]
        scope.set_tag("stacktrace_link.platform", platform)
        if platform is not None:
            scope.set_attribute("stacktrace_link.platform", platform)

        scope.set_tag("stacktrace_link.code_mappings", has_code_mappings)
        scope.set_attribute("stacktrace_link.code_mappings", has_code_mappings)
        scope.set_tag("stacktrace_link.file", ctx["file"])
        scope.set_attribute("stacktrace_link.file", ctx["file"])
        # Add tag if filepath is Windows
        if ctx["file"] and ctx["file"].find(":\\") > -1:
            scope.set_tag("stacktrace_link.windows", True)
            scope.set_attribute("stacktrace_link.windows", True)

        abs_path = ctx["abs_path"]
        scope.set_tag("stacktrace_link.abs_path", abs_path)
        if abs_path is not None:
            scope.set_attribute("stacktrace_link.abs_path", abs_path)

        if ctx["platform"] == "python":
            # This allows detecting a file that belongs to Python's 3rd party modules
            scope.set_tag("stacktrace_link.in_app", "site-packages" not in str(ctx["abs_path"]))
            scope.set_attribute(
                "stacktrace_link.in_app", "site-packages" not in str(ctx["abs_path"])
            )
    except Exception:
        # If errors arises we can still proceed
        logger.exception("We failed to set a tag.")


def set_tags(scope: Scope, result: StacktraceLinkOutcome, integrations: Collection[Any]) -> None:
    scope.set_tag("stacktrace_link.found", result["source_url"] is not None)
    scope.set_attribute("stacktrace_link.found", result["source_url"] is not None)

    source_url = result["source_url"]
    scope.set_tag("stacktrace_link.source_url", source_url)
    if source_url is not None:
        scope.set_attribute("stacktrace_link.source_url", source_url)

    error = result["error"]
    scope.set_tag("stacktrace_link.error", error)
    if error is not None:
        scope.set_attribute("stacktrace_link.error", error)

    if result["current_config"]:
        attempted_url = result["current_config"]["outcome"].get("attemptedUrl")
        scope.set_tag("stacktrace_link.tried_url", attempted_url)
        if attempted_url is not None:
            scope.set_attribute("stacktrace_link.tried_url", attempted_url)

        scope.set_tag(
            "stacktrace_link.auto_derived",
            result["current_config"]["config"].automatically_generated is True,
        )
        scope.set_attribute(
            "stacktrace_link.auto_derived",
            result["current_config"]["config"].automatically_generated is True,
        )
    scope.set_tag("stacktrace_link.has_integration", len(integrations) > 0)
    scope.set_attribute("stacktrace_link.has_integration", len(integrations) > 0)


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class ProjectStacktraceLinkEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
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
    max_acceptable_duration = 10.0

    @extend_schema(
        operation_id="getProjectStacktraceLink",
        summary="Get a Source Code Link for a Stack Trace Frame",
        description=(
            "Resolve a stack trace filename to its linked source file using the project's code "
            "mappings and connected source code integrations."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                "file",
                type=str,
                required=True,
                description="The file path from the stack trace frame.",
            ),
            OpenApiParameter(
                "platform", type=str, description="The platform associated with the frame."
            ),
            OpenApiParameter(
                "absPath", type=str, description="The absolute path of the stack frame, if known."
            ),
            OpenApiParameter(
                "commitId", type=str, description="The commit ID associated with the event."
            ),
            OpenApiParameter(
                "sdkName", type=str, description="The SDK name associated with the event."
            ),
            OpenApiParameter("module", type=str, description="The module name, if known."),
            OpenApiParameter("package", type=str, description="The package name, if known."),
            OpenApiParameter("lineNo", type=str, description="The source line number, if known."),
            OpenApiParameter("groupId", type=str, description="The issue ID, if known."),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "StacktraceLinkResponse", StacktraceLinkResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, project: Project
    ) -> Response[StacktraceLinkResponse] | Response[DetailResponse]:
        ctx = generate_context(request.GET)
        filepath = ctx["file"]
        if not filepath:
            return Response({"detail": "Filepath is required"}, status=400)

        integrations = integration_service.get_integrations(organization_id=project.organization_id)
        # TODO(meredith): should use get_provider.has_feature() instead once this is
        # no longer feature gated and is added as an IntegrationFeature
        serializer = IntegrationSerializer()
        serialized_integrations = [
            serialize(i, request.user, serializer)
            for i in integrations
            if i.has_feature(IntegrationFeatures.STACKTRACE_LINK)
        ]

        configs = get_sorted_code_mapping_configs(project)
        if not configs:
            return Response(
                {
                    "config": None,
                    "sourceUrl": None,
                    "integrations": serialized_integrations,
                    "error": "no_code_mappings_for_project",
                }
            )

        attempted_url = None
        error = None
        serialized_config = None

        scope = Scope.get_isolation_scope()

        set_top_tags(scope, project, ctx, len(configs) > 0)
        result = get_stacktrace_config(configs, ctx)
        error = result["error"]
        src_path = result["src_path"]
        # Post-processing before exiting scope context
        if result["current_config"]:
            # Use the provider key to split up stacktrace-link metrics by integration type
            serialized_config = serialize(result["current_config"]["config"], request.user)
            provider = serialized_config["provider"]["key"]
            scope.set_tag("integration_provider", provider)  # e.g. github
            scope.set_attribute("integration_provider", provider)

            if not result["source_url"]:
                error = result["current_config"]["outcome"].get("error")
                # When no code mapping have been matched we have not attempted a URL
                if result["current_config"]["outcome"].get("attemptedUrl"):
                    attempted_url = result["current_config"]["outcome"].get("attemptedUrl")
        try:
            set_tags(scope, result, serialized_integrations)
        except Exception:
            logger.exception("Failed to set tags.")

        if result["current_config"] and serialized_config:
            analytics.record(
                IntegrationStacktraceLinkEvent(
                    provider=serialized_config["provider"]["key"],
                    config_id=serialized_config["id"],
                    project_id=project.id,
                    organization_id=project.organization_id,
                    filepath=filepath,
                    status=error or "success",
                    link_fetch_iterations=result["iteration_count"],
                    platform=ctx["platform"],
                )
            )
            return Response(
                {
                    "error": error,
                    "config": serialized_config,
                    "sourcePath": src_path,
                    "sourceUrl": result["source_url"],
                    "attemptedUrl": attempted_url,
                    "integrations": serialized_integrations,
                }
            )

        return Response(
            {
                "error": error,
                "config": serialized_config,
                "sourcePath": src_path,
                "sourceUrl": None,
                "attemptedUrl": attempted_url,
                "integrations": serialized_integrations,
            }
        )

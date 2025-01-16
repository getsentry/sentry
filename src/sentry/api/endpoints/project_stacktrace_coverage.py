from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope, start_span

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.integrations.utils.codecov import codecov_enabled, fetch_codecov_data
from sentry.integrations.utils.stacktrace_link import get_stacktrace_config
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.issues.endpoints.project_stacktrace_link import generate_context
from sentry.models.project import Project
from sentry.utils import metrics


@region_silo_endpoint
class ProjectStacktraceCoverageEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    """
    Returns codecov data for a given stacktrace.
    Similar to stacktrace-link, but for coverage data.

    `file`: The file path from the stack trace
    `commitId` (optional): The commit_id for the last commit of the
                           release associated to the stack trace's event
    `sdkName` (optional): The sdk.name associated with the event
    `absPath` (optional): The abs_path field value of the relevant stack frame
    `module`  (optional): The module field value of the relevant stack frame
    `package` (optional): The package field value of the relevant stack frame
    `groupId` (optional): The Issue's id.
    """

    owner = ApiOwner.ISSUES

    def get(self, request: Request, project: Project) -> Response:
        should_get_coverage = codecov_enabled(project.organization)
        if not should_get_coverage:
            return Response({"detail": "Codecov not enabled"}, status=400)

        ctx = generate_context(request.GET)
        filepath = ctx.get("file")
        if not filepath:
            return Response({"detail": "Filepath is required"}, status=400)

        configs = get_sorted_code_mapping_configs(project)
        if not configs:
            return Response({"detail": "No code mappings found for this project"}, status=400)

        result = get_stacktrace_config(configs, ctx)
        error = result["error"]
        serialized_config = None

        # Post-processing before exiting scope context
        if result["current_config"]:
            scope = Scope.get_isolation_scope()

            serialized_config = serialize(result["current_config"]["config"], request.user)
            provider = serialized_config["provider"]["key"]
            # Use the provider key to split up stacktrace-link metrics by integration type
            scope.set_tag("integration_provider", provider)  # e.g. github

            with start_span(op="fetch_codecov_data"):
                with metrics.timer("issues.stacktrace.fetch_codecov_data"):
                    codecov_data = fetch_codecov_data(
                        config={
                            "repository": result["current_config"]["repository"],
                            "config": serialized_config,
                            "outcome": result["current_config"]["outcome"],
                        }
                    )
                    return Response(codecov_data)

        return Response({"error": error, "config": serialized_config}, status=400)

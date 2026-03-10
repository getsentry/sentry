from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.integrations.utils.source_context import fetch_source_context_from_scm
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.issues.endpoints.project_stacktrace_link import generate_context
from sentry.models.project import Project

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectStacktraceSourceContextEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    """
    Returns source context lines for a stack trace frame by fetching the file
    from the configured SCM integration (GitHub, GitLab, Perforce, etc.).

    `file`: The file path from the stack trace (required)
    `lineNo`: The line number to fetch context around (required)
    `commitId` (optional): The commit_id for the last commit of the release
    `platform` (optional): The platform of the event
    `sdkName` (optional): The sdk.name associated with the event
    `absPath` (optional): The abs_path field value of the relevant stack frame
    `module`  (optional): The module field value of the relevant stack frame
    `package` (optional): The package field value of the relevant stack frame
    """

    owner = ApiOwner.ISSUES

    def get(self, request: Request, project: Project) -> Response:
        if not features.has(
            "organizations:scm-source-context",
            project.organization,
            actor=request.user,
        ):
            return Response(status=404)

        ctx = generate_context(request.GET)

        if not ctx["file"]:
            return Response({"detail": "Filepath is required"}, status=400)

        if not ctx["line_no"]:
            return Response({"detail": "lineNo is required"}, status=400)

        configs = get_sorted_code_mapping_configs(project)
        if not configs:
            return Response(
                {
                    "context": [],
                    "error": "no_code_mappings_for_project",
                    "sourceUrl": None,
                }
            )

        result = fetch_source_context_from_scm(configs, ctx)

        return Response(
            {
                "context": result["context"],
                "error": result["error"],
                "sourceUrl": result["source_url"],
            }
        )

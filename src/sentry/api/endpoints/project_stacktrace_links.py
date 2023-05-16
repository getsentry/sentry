from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.mixins import RepositoryMixin
from sentry.models import Project, RepositoryProjectPathConfig
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError

from .project_stacktrace_link import get_code_mapping_configs

MAX_CODE_MAPPINGS_USED = 3


class StacktraceLinksSerializer(serializers.Serializer):  # type: ignore
    file = serializers.ListField(child=serializers.CharField())
    commit_id = serializers.CharField(required=False)


@region_silo_endpoint
class ProjectStacktraceLinksEndpoint(ProjectEndpoint):  # type: ignore
    """
    Returns valid links for source code providers so that
    users can go from the file in the stack trace to the
    provider of their choice.

    Simular to `ProjectStacktraceLinkEndpoint` but allows
    for bulk resolution.

    `file`: The file path from the stack trace
    `commitId` (optional): The commit_id for the last commit of the
                           release associated to the stack trace's event
    """

    def get(self, request: Request, project: Project) -> Response:
        serializer = StacktraceLinksSerializer(data=request.GET)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        result = {"files": [{"file": file, "sourceUrl": None} for file in data["file"]]}

        configs = get_code_mapping_configs(project)

        mappings_used = 0

        default_error = "stack_root_mismatch"

        for config in configs:
            if mappings_used >= MAX_CODE_MAPPINGS_USED:
                # safety to ensure that a maximum number of mappings are used to avoid
                # reaching API rate limits
                default_error = "max_code_mappings_applied"
                break

            # find all the files that match the current code mapping's stack_root and have not
            # already been resolved by another code mapping
            files = [
                file
                for file in result["files"]
                if file["sourceUrl"] is None and file["file"].startswith(config.stack_root)
            ]
            if not files:
                continue

            mappings_used += 1

            install = get_installation(config)
            version = data.get("commit_id", config.default_branch)

            # since the same code mapping stack root matches all these files, we only check the
            # first file and we will assume the other matching files will resolve the same way
            error = check_file(install, config, files[0]["file"], version)

            for file in files:
                formatted_path = file["file"].replace(config.stack_root, config.source_root, 1)
                url = install.format_source_url(config.repository, formatted_path, version)
                if error:
                    file["error"] = error
                    file["attemptedUrl"] = url
                else:
                    file["sourceUrl"] = url

        for file in result["files"]:
            if not file.get("error") and file["sourceUrl"] is None:
                file["error"] = default_error

        return Response(result, status=200)


def get_installation(config: RepositoryProjectPathConfig) -> IntegrationInstallation:
    integration = integration_service.get_integration(
        organization_integration_id=config.organization_integration_id
    )
    return integration_service.get_installation(
        integration=integration, organization_id=config.project.organization_id
    )


def check_file(
    install: IntegrationInstallation,
    config: RepositoryProjectPathConfig,
    filepath: str,
    version: str,
) -> str | None:
    formatted_path = filepath.replace(config.stack_root, config.source_root, 1)

    link = None
    try:
        if isinstance(install, RepositoryMixin):
            # TODO: do we want to fall back to the default branch here?
            link = install.get_stacktrace_link(config.repository, formatted_path, version, "")
    except ApiError as e:
        if e.code != 403:
            raise
        return "integration_link_forbidden"

    if not link:
        return "file_not_found"

    return None

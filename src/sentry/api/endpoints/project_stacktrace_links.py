from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.mixins import RepositoryMixin
from sentry.integrations.utils.code_mapping import get_sorted_code_mapping_configs
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.sdk import set_measurement

MAX_CODE_MAPPINGS_USED = 3


class StacktraceLinksSerializer(serializers.Serializer):
    file = serializers.ListField(child=serializers.CharField())

    # falls back to the default branch
    ref = serializers.CharField(required=False)


@region_silo_endpoint
class ProjectStacktraceLinksEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    """
    Returns valid links for source code providers so that
    users can go from files in the stack trace to the
    provider of their choice.

    Similar to `ProjectStacktraceLinkEndpoint` but allows
    for bulk resolution.

    `file`: The file paths from the stack trace
    `ref` (optional): The commit_id for the last commit of the
                           release associated to the stack trace's event
    """

    def get(self, request: Request, project: Project) -> Response:
        if not features.has(
            "organizations:profiling-stacktrace-links", project.organization, actor=request.user
        ):
            return Response(status=404)

        serializer = StacktraceLinksSerializer(data=request.GET)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        result = {"files": [{"file": file} for file in data["file"]]}

        mappings_used = 0
        mappings_attempted = 0

        configs = get_sorted_code_mapping_configs(project)

        default_error = "stack_root_mismatch" if configs else "no_code_mappings"

        for config in configs:
            # find all the files that match the current code mapping's stack_root
            # and have not already been resolved by another code mapping
            #
            # if the's an error from a previous code mapping attempted, but this
            # current code mapping can be used, we should try again
            files = [
                file
                for file in result["files"]
                if file.get("sourceUrl") is None and file["file"].startswith(config.stack_root)
            ]
            if not files:
                continue

            mappings_attempted += 1

            # safety to limit the maximum number of mappings used
            # to avoid reaching API rate limits
            if mappings_used >= MAX_CODE_MAPPINGS_USED:
                for file in files:
                    if not file.get("error") and file.get("sourceUrl") is None:
                        file["error"] = "max_code_mappings_applied"
                continue

            mappings_used += 1

            install = get_installation(config)

            # should always be overwritten
            error: str | None = "file_not_checked"

            # since the same code mapping stack root matches all these files, we only check the
            # first file and we will assume the other matching files will resolve the same way
            ref = data.get("ref")
            if ref:
                error = check_file(install, config, files[0]["file"], ref)
            if not ref or error:
                ref = config.default_branch
                error = check_file(install, config, files[0]["file"], ref)

            for file in files:
                formatted_path = file["file"].replace(config.stack_root, config.source_root, 1)
                url = install.format_source_url(config.repository, formatted_path, ref)
                if error:
                    file["error"] = error
                    file["attemptedUrl"] = url
                else:
                    file["sourceUrl"] = url

                    # there may be an error from an previous code mapping, clear it
                    if "error" in file:
                        del file["error"]
                    if "attemptedUrl" in file:
                        del file["attemptedUrl"]

        # number of available code mappings
        set_measurement("mappings.found", len(configs))

        # number of code mappings that matched a stack root
        set_measurement("mappings.attempted", mappings_attempted)

        # number of code mappings that was attempted
        set_measurement("mappings.used", mappings_used)

        for file in result["files"]:
            if not file.get("error") and file.get("sourceUrl") is None:
                file["error"] = default_error

        return Response(result, status=200)


def get_installation(config: RepositoryProjectPathConfig) -> IntegrationInstallation:
    integration = integration_service.get_integration(
        organization_integration_id=config.organization_integration_id
    )
    return integration.get_installation(organization_id=config.project.organization_id)


def check_file(
    install: IntegrationInstallation,
    config: RepositoryProjectPathConfig,
    filepath: str,
    ref: str,
) -> str | None:
    """
    Checks to see if the given filepath exists using the given code mapping + ref.

    Returns a string indicating the error if it doesn't exist, and `None` otherwise.
    """

    formatted_path = filepath.replace(config.stack_root, config.source_root, 1)

    link = None
    try:
        if isinstance(install, RepositoryMixin):
            # the logic to fall back to the default branch is handled from the caller
            link = install.get_stacktrace_link(config.repository, formatted_path, ref, "")
    except ApiError as e:
        if e.code != 403:
            raise
        return "integration_link_forbidden"

    if not link:
        return "file_not_found"

    return None

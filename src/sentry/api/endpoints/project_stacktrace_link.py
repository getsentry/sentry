from typing import Any, Mapping, Optional, Tuple

from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import configure_scope

from sentry import analytics
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.integrations import IntegrationFeatures
from sentry.models import Integration, RepositoryProjectPathConfig
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.event_frames import munged_filename_and_frames


def get_link(
    config: RepositoryProjectPathConfig, filepath: str, default: str, version: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    oi = config.organization_integration
    integration = oi.integration
    install = integration.get_installation(oi.organization_id)

    formatted_path = filepath.replace(config.stack_root, config.source_root, 1)

    link, attempted_url, error = None, None, None
    try:
        link = install.get_stacktrace_link(config.repository, formatted_path, default, version)
    except ApiError as e:
        if e.code != 403:
            raise
        error = "integration_link_forbidden"

    # If the link was not found, attach the URL that we attempted.
    if not link:
        error = error or "file_not_found"
        attempted_url = install.format_source_url(config.repository, formatted_path, default)
    return link, attempted_url, error


@region_silo_endpoint
class ProjectStacktraceLinkEndpoint(ProjectEndpoint):
    """
    Returns valid links for source code providers so that
    users can go from the file in the stack trace to the
    provider of their choice.

    `filepath`: The file path from the stack trace
    `commitId` (optional): The commit_id for the last commit of the
                           release associated to the stack trace's event
    `sdkName` (optional): The sdk.name associated with the event
    `absPath` (optional): The abs_path field value of the relevant stack frame
    `module`   (optional): The module field value of the relevant stack frame
    `package`  (optional): The package field value of the relevant stack frame

    """

    def get(self, request: Request, project) -> Response:
        # should probably feature gate
        filepath = request.GET.get("file")
        if not filepath:
            return Response({"detail": "Filepath is required"}, status=400)

        commit_id = request.GET.get("commitId")
        platform = request.GET.get("platform")
        sdk_name = request.GET.get("sdkName")
        abs_path = request.GET.get("absPath")
        module = request.GET.get("module")
        package = request.GET.get("package")
        frame = {}
        if abs_path:
            frame["abs_path"] = abs_path
        if module:
            frame["module"] = module
        if package:
            frame["package"] = package
        result = {"config": None, "sourceUrl": None}

        integrations = Integration.objects.filter(organizations=project.organization_id)
        # TODO(meredith): should use get_provider.has_feature() instead once this is
        # no longer feature gated and is added as an IntegrationFeature
        result["integrations"] = [
            serialize(i, request.user)
            for i in integrations
            if i.has_feature(IntegrationFeatures.STACKTRACE_LINK)
        ]

        last_error = None
        # xxx(meredith): if there are ever any changes to this query, make
        # sure that we are still ordering by `id` because we want to make sure
        # the ordering is deterministic
        # codepath mappings must have an associated integration for stacktrace linking.
        configs = RepositoryProjectPathConfig.objects.filter(
            project=project, organization_integration__isnull=False
        )
        with configure_scope() as scope:
            for config in configs:
                if not filepath.startswith(config.stack_root) and not frame:
                    last_error = "stack_root_mismatch"
                    continue

                result["config"] = serialize(config, request.user)
                # use the provider key to be able to split up stacktrace
                # link metrics by integration type
                provider = result["config"]["provider"]["key"]
                scope.set_tag("integration_provider", provider)
                scope.set_tag("stacktrace_link.platform", platform)

                link, attempted_url, get_link_error = get_link(
                    config, filepath, config.default_branch, commit_id
                )

                if not link and frame:
                    frame["filename"] = filepath
                    munged_frames = munged_filename_and_frames(
                        platform, [frame], "munged_filename", sdk_name=sdk_name
                    )
                    if munged_frames:
                        munged_frame: Mapping[str, Any] = munged_frames[1][0]
                        munged_filename = str(munged_frame.get("munged_filename"))
                        if munged_filename:
                            if not filepath.startswith(
                                config.stack_root
                            ) and not munged_filename.startswith(config.stack_root):
                                last_error = "stack_root_mismatch"
                                continue

                            link, attempted_url, error = get_link(
                                config, munged_filename, config.default_branch, commit_id
                            )

                # it's possible for the link to be None, and in that
                # case it means we could not find a match for the
                # configuration
                result["sourceUrl"] = link
                if not link:
                    last_error = get_link_error
                    result["attemptedUrl"] = attempted_url
                else:
                    scope.set_tag("stacktrace_link.found", True)
                    # if we found a match, we can break
                    break

            # Post-processing before exiting scope context
            if last_error:
                result["error"] = last_error
                if last_error == "stack_root_mismatch":
                    scope.set_tag("stacktrace_link.error", "stack_root_mismatch")
                else:
                    scope.set_tag("stacktrace_link.found", False)
                    scope.set_tag("stacktrace_link.error", "file_not_found")

        if result["config"]:
            analytics.record(
                "integration.stacktrace.linked",
                provider=result["config"]["provider"]["key"],
                config_id=result["config"]["id"],
                project_id=project.id,
                organization_id=project.organization_id,
                filepath=filepath,
                status=result.get("error") or "success",
            )

        return Response(result)

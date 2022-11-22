import copy
import logging
from typing import Mapping, Optional, Sequence

from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope, configure_scope

from sentry import analytics
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.integrations import IntegrationFeatures
from sentry.models import Integration, Project, RepositoryProjectPathConfig
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.event_frames import munged_filename_and_frames

logger = logging.getLogger(__name__)


def get_link(
    config: RepositoryProjectPathConfig, ctx: Mapping[str, Optional[str]]
) -> Mapping[str, str]:
    result = {}
    filepath = str(ctx["file"])
    version = ctx["commit_id"]
    oi = config.organization_integration
    integration = oi.integration
    install = integration.get_installation(oi.organization_id)

    formatted_path = filepath.replace(config.stack_root, config.source_root, 1)

    link = None
    try:
        link = install.get_stacktrace_link(
            config.repository, formatted_path, config.default_branch, version
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
        result["attemptedUrl"] = install.format_source_url(
            config.repository, formatted_path, config.default_branch
        )

    return result


def generate_context(parameters: Mapping[str, str]) -> Mapping[str, Optional[str]]:
    return {
        "file": parameters.get("file"),
        "commit_id": parameters.get("commitId"),
        "platform": parameters.get("platform"),
        "sdk_name": parameters.get("sdkName"),
        "abs_path": parameters.get("absPath"),
        "module": parameters.get("module"),
        "package": parameters.get("package"),
    }


def get_integrations(organization_id: int, user: str) -> Sequence[str]:
    integrations = Integration.objects.filter(organizations=organization_id)
    # TODO(meredith): should use get_provider.has_feature() instead once this is
    # no longer feature gated and is added as an IntegrationFeature
    return [
        serialize(i, user)
        for i in integrations
        if i.has_feature(IntegrationFeatures.STACKTRACE_LINK)
    ]


def set_top_tags(scope: Scope, project: Project) -> None:
    scope.set_tag("project.slug", project.slug)
    scope.set_tag("organization.slug", project.organization.slug)
    try:
        scope.set_tag("organization.early_adopter", project.organization.flags.early_adopter)
    except Exception:
        # If errors arise we can then follow up with a fix
        logger.exception("We failed to set the early adopter flag")


# This is to support mobile languages with non-fully-qualified file pathing.
# We attempt to 'munge' the proper source-relative filepath based on the stackframe data.
def try_path_munging(
    config: RepositoryProjectPathConfig, ctx: Mapping[str, Optional[str]]
) -> Mapping[str, str]:
    result: Mapping[str, str] = {}
    munged_ctx = dict(copy.deepcopy(ctx))
    filepath = str(munged_ctx["file"])
    # XXX: Change munged_filename_and_frames to make some of these unnecessary
    munged_ctx["filename"] = filepath
    munged_frames = munged_filename_and_frames(
        str(ctx["platform"]), [ctx], "munged_filename", sdk_name=str(ctx["sdk_name"])
    )
    if munged_frames:
        munged_frame: Mapping[str, Mapping[str, str]] = munged_frames[1][0]
        munged_filename = str(munged_frame.get("munged_filename"))
        logger.info(f"We are going to attempt some munging (New filepath: {munged_filename}).")
        if munged_filename:
            munged_ctx["filename"] = munged_filename
            if not filepath.startswith(config.stack_root) and not munged_filename.startswith(
                config.stack_root
            ):
                result = {"error": "stack_root_mismatch"}
            else:
                result = get_link(config, munged_ctx)

    return result


@region_silo_endpoint
class ProjectStacktraceLinkEndpoint(ProjectEndpoint):  # type: ignore
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

    """

    def get(self, request: Request, project: Project) -> Response:
        ctx = generate_context(request.GET)
        filepath = ctx["file"]
        if not filepath:
            return Response({"detail": "Filepath is required"}, status=400)

        result = {
            "config": None,
            "sourceUrl": None,
            # It's unclear where this is used or why it's returned in the endpoint
            "integrations": get_integrations(project.organization_id, request.user),
        }

        # xxx(meredith): if there are ever any changes to this query, make
        # sure that we are still ordering by `id` because we want to make sure
        # the ordering is deterministic
        # codepath mappings must have an associated integration for stacktrace linking.
        configs = RepositoryProjectPathConfig.objects.filter(
            project=project, organization_integration__isnull=False
        )
        matched_code_mappings = []
        with configure_scope() as scope:
            set_top_tags(scope, project)
            for config in configs:
                # If all code mappings fail to match a stack_root it means that there's no working code mapping
                if not filepath.startswith(config.stack_root):
                    # Later on, if there are matching code mappings this will be overwritten
                    result["error"] = "stack_root_mismatch"
                    continue

                outcome = get_link(config, ctx)  # If this fails we have an invalid code mapping
                if not outcome.get("sourceUrl"):
                    munging_outcome = try_path_munging(config, ctx)
                    # If we failed to munge we should keep the original outcome
                    if munging_outcome:
                        outcome = munging_outcome

                current_config = {"config": serialize(config, request.user), "outcome": outcome}
                matched_code_mappings.append(current_config)
                # use the provider key to be able to split up stacktrace
                # link metrics by integration type
                provider = current_config["config"]["provider"]["key"]
                scope.set_tag("integration_provider", provider)  # e.g. github

                if outcome.get("sourceUrl") and outcome["sourceUrl"]:
                    result["sourceUrl"] = outcome["sourceUrl"]
                    # if we found a match, we can break
                    break

            # Post-processing before exiting scope context
            found: bool = result["sourceUrl"] is not None
            scope.set_tag("stacktrace_link.found", found)
            scope.set_tag("stacktrace_link.platform", ctx["platform"])
            if matched_code_mappings:
                # Any code mapping that matched and its associated outcome will be returned
                result["matched_code_mappings"] = matched_code_mappings  # type: ignore
                last = matched_code_mappings[-1]
                result["config"] = last["config"]  # Backwards compatible
                if not found:
                    result["error"] = last["outcome"]["error"] or result["error"]
                    result["attemptedUrl"] = last["outcome"]["attemptedUrl"]  # Backwards compatible
                    # This means that the matched code mappings were invalid
                    # scope.set_tag("stacktrace_link.error", "file_not_found")
            # No code mapping matched, thus, not matched_code_mappings
            if result.get("error") == "stack_root_mismatch":
                scope.set_tag("stacktrace_link.error", "stack_root_mismatch")

        if result["config"]:
            analytics.record(
                "integration.stacktrace.linked",
                provider=result["config"]["provider"]["key"],  # type: ignore
                config_id=result["config"]["id"],  # type: ignore
                project_id=project.id,
                organization_id=project.organization_id,
                filepath=filepath,
                status=result.get("error") or "success",
            )

        return Response(result)

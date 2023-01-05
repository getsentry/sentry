import logging
from typing import Dict, List, Mapping, Optional

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
from sentry.utils.json import JSONData

logger = logging.getLogger(__name__)


def get_link(
    config: RepositoryProjectPathConfig, filepath: str, version: Optional[str] = None
) -> Dict[str, str]:
    result = {}
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
        scope.set_tag("stacktrace_link.abs_path", ctx["abs_path"])
        if ctx["platform"] == "python":
            # This allows detecting a file that belongs to Python's 3rd party modules
            scope.set_tag("stacktrace_link.in_app", "site-packages" not in str(ctx["abs_path"]))
    except Exception:
        # If errors arises we can still proceed
        logger.exception("We failed to set a tag.")


def try_path_munging(
    config: RepositoryProjectPathConfig,
    filepath: str,
    ctx: Mapping[str, Optional[str]],
) -> Dict[str, str]:
    result: Dict[str, str] = {}
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
                result = get_link(config, munged_filename, ctx["commit_id"])

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

    def sort_code_mapping_configs(
        self,
        configs: List[RepositoryProjectPathConfig],
    ) -> List[RepositoryProjectPathConfig]:
        """
        Sorts the code mapping config list based on precedence.
        User generated code mappings are evaluated before Sentry generated code mappings.
        Code mappings with more defined stack trace roots are evaluated before less defined stack trace
        roots.

        `configs`: The list of code mapping configs

        """
        sorted_configs = []  # type: List[RepositoryProjectPathConfig]
        for config in configs:
            inserted = False
            for index, sorted_config in enumerate(sorted_configs):
                # This check will ensure that all user defined code mappings will come before Sentry generated ones
                if (
                    sorted_config.automatically_generated and not config.automatically_generated
                ) or (  # Insert more defined stack roots before less defined ones
                    (sorted_config.automatically_generated == config.automatically_generated)
                    and config.stack_root.startswith(sorted_config.stack_root)
                ):
                    sorted_configs.insert(index, config)
                    inserted = True
                    break
            if not inserted:
                # Insert the code mapping at the back if it's Sentry generated or at the front if it is user defined
                if config.automatically_generated:
                    sorted_configs.insert(len(sorted_configs), config)
                else:
                    sorted_configs.insert(0, config)
        return sorted_configs

    def get(self, request: Request, project: Project) -> Response:
        ctx = generate_context(request.GET)
        filepath = ctx.get("file")
        if not filepath:
            return Response({"detail": "Filepath is required"}, status=400)

        result: JSONData = {"config": None, "sourceUrl": None}

        integrations = Integration.objects.filter(organizations=project.organization_id)
        # TODO(meredith): should use get_provider.has_feature() instead once this is
        # no longer feature gated and is added as an IntegrationFeature
        result["integrations"] = [
            serialize(i, request.user)
            for i in integrations
            if i.has_feature(IntegrationFeatures.STACKTRACE_LINK)
        ]

        # xxx(meredith): if there are ever any changes to this query, make
        # sure that we are still ordering by `id` because we want to make sure
        # the ordering is deterministic
        # codepath mappings must have an associated integration for stacktrace linking.
        configs = RepositoryProjectPathConfig.objects.filter(
            project=project, organization_integration__isnull=False
        )
        try:
            configs = self.sort_code_mapping_configs(configs)
        except Exception:
            logger.exception("There was a failure sorting the code mappings")

        derived = False
        current_config = None
        with configure_scope() as scope:
            set_top_tags(scope, project, ctx, len(configs) > 0)
            for config in configs:
                # If all code mappings fail to match a stack_root it means that there's no working code mapping
                if not filepath.startswith(config.stack_root):
                    # Later on, if there are matching code mappings this will be overwritten
                    result["error"] = "stack_root_mismatch"
                    continue
                if (
                    filepath.startswith(config.stack_root)
                    and config.automatically_generated is True
                ):
                    derived = True

                outcome = {}
                munging_outcome = {}
                # If the platform is a mobile language, get_link will never get the right URL without munging
                if ctx["platform"] in ["java", "cocoa", "other"]:
                    munging_outcome = try_path_munging(config, filepath, ctx)
                if not munging_outcome:
                    outcome = get_link(config, filepath, ctx["commit_id"])
                    # In some cases the stack root matches and it can either be that we have
                    # an invalid code mapping or that munging is expect it to work
                    if not outcome.get("sourceUrl"):
                        munging_outcome = try_path_munging(config, filepath, ctx)
                # If we failed to munge we should keep the original outcome
                if munging_outcome:
                    outcome = munging_outcome
                    scope.set_tag("stacktrace_link.munged", True)

                current_config = {"config": serialize(config, request.user), "outcome": outcome}
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
            scope.set_tag("stacktrace_link.auto_derived", derived)
            if current_config:
                result["config"] = current_config["config"]
                if not found:
                    result["error"] = current_config["outcome"]["error"]
                    # When no code mapping have been matched we have not attempted a URL
                    if current_config["outcome"].get("attemptedUrl"):
                        result["attemptedUrl"] = current_config["outcome"]["attemptedUrl"]
                    if result["error"] == "stack_root_mismatch":
                        scope.set_tag("stacktrace_link.error", "stack_root_mismatch")
                    else:
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

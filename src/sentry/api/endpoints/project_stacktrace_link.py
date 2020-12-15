from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Integration, RepositoryProjectPathConfig
from sentry.api.serializers import serialize
from sentry.utils.compat import filter

from sentry_sdk import configure_scope


def get_link(config, filepath, default, version=None):
    oi = config.organization_integration
    integration = oi.integration
    install = integration.get_installation(oi.organization_id)

    formatted_path = filepath.replace(config.stack_root, config.source_root, 1)

    return install.get_stacktrace_link(config.repository, formatted_path, default, version)


class ProjectStacktraceLinkEndpoint(ProjectEndpoint):
    """
    Returns valid links for source code providers so that
    users can go from the file in the stack trace to the
    provider of their choice.

    `filepath`: The file path from the strack trace
    `commitId` (optional): The commit_id for the last commit of the
                           release associated to the stack trace's event

    """

    def get(self, request, project):
        # should probably feature gate
        filepath = request.GET.get("file")
        if not filepath:
            return Response({"detail": "Filepath is required"}, status=400)

        commitId = request.GET.get("commitId")
        platform = request.GET.get("platform")
        result = {"config": None, "sourceUrl": None}

        integrations = Integration.objects.filter(organizations=project.organization_id)
        # TODO(meredith): should use get_provider.has_feature() instead once this is
        # no longer feature gated and is added as an IntegrationFeature
        result["integrations"] = [
            serialize(i, request.user)
            for i in filter(lambda i: i.get_provider().has_stacktrace_linking, integrations)
        ]

        # xxx(meredith): if there are ever any changes to this query, make
        # sure that we are still ordering by `id` because we want to make sure
        # the ordering is deterministic
        configs = RepositoryProjectPathConfig.objects.filter(project=project)
        with configure_scope() as scope:
            for config in configs:

                result["config"] = serialize(config, request.user)
                # use the provider key to be able to spilt up stacktrace
                # link metrics by integration type
                provider = result["config"]["provider"]["key"]
                scope.set_tag("integration_provider", provider)
                scope.set_tag("stacktrace_link.platform", platform)

                if not filepath.startswith(config.stack_root):
                    scope.set_tag("stacktrace_link.error", "stack_root_mismatch")
                    result["error"] = "stack_root_mismatch"
                    continue

                link = get_link(config, filepath, config.default_branch, commitId)

                # it's possible for the link to be None, and in that
                # case it means we could not find a match for the
                # configuration
                result["sourceUrl"] = link
                if not link:
                    scope.set_tag("stacktrace_link.found", False)
                    scope.set_tag("stacktrace_link.error", "file_not_found")
                    result["error"] = "file_not_found"
                else:
                    scope.set_tag("stacktrace_link.found", True)
                    # if we found a match, we can break
                    break

        return Response(result)

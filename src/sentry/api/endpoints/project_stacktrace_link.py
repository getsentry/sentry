from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import RepositoryProjectPathConfig
from sentry.api.serializers import serialize


def get_link(config, filepath, version):
    oi = config.organization_integration
    integration = oi.integration
    install = integration.get_installation(oi.organization_id)

    formatted_path = filepath.replace(config.stack_root, config.source_root)

    return install.get_stacktrace_link(config.repository, formatted_path, version)


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
            return Response("Filepath is required", status=400)

        commitId = request.GET.get("commitId")
        result = {"config": None}

        configs = RepositoryProjectPathConfig.objects.filter(project=project)
        # we only want to attempt the stack trace linking IF the user
        # has a configuration set up, otherwise we don't care
        if not configs:
            return Response(result)

        for config in configs:
            if not filepath.startswith(config.stack_root):
                continue

            version = commitId or config.default_branch

            link = get_link(config, filepath, version)

            result["config"] = serialize(config, request.user)
            # it's possible for the link to be None, and in that
            # case it means we could not find a match for the
            # configuration
            result["source_url"] = link

        return Response(result)

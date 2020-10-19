from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import RepositoryProjectPathConfig
from sentry.shared_integrations.exceptions import ApiError


def get_link(config, filepath, version):
    # feel like there has got to be a better way to do this
    # if we already have the oi
    oi = config.organization_integration
    integration = oi.integration
    install = integration.get_installation(oi.organization_id)

    filepath.replace(config.stack_root, config.source_root)

    return install.get_stacktrace_link(config.repository, filepath, version)


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
        commitId = request.GET.get("commitId")

        results = []
        # try and find any configurations set up, if there
        # aren't any then we don't do anything else
        configs = RepositoryProjectPathConfig.objects.filter(project=project,)

        if not configs:
            return Response(results)

        for config in configs:
            version = commitId or config.default_branch
            try:
                link = get_link(config, filepath, version)
                # don't think we need the whole configuration, but we
                # may want to know what provider it is e.g. GH
                results.append({"config": config, "source_url": link})

            except ApiError:
                # this could mean either we couldn't find a match
                # or something else when wrong with the request,
                # either way, we have a configuration without a match
                #
                # not sure exactly what we want to show the user, if anything
                pass

        return Response(results)

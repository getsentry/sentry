from rest_framework.response import Response

from sentry import features
from sentry.api.bases import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.projectoptions.defaults import BETA_GROUPING_CONFIG, DEFAULT_GROUPING_CONFIG


class ProjectGroupingConfigsEndpoint(ProjectEndpoint):
    """Retrieve available grouping configs with project-specific information

    See GroupingConfigsEndpoint
    """

    def get(self, request, project):

        configs = [
            config.as_dict() for config in sorted(CONFIGURATIONS.values(), key=lambda x: x.id)
        ]
        latest = next(config["id"] for config in configs if config["latest"])

        # As long as newstyle:2019-10-29 is the global "latest", allow orgs to upgrade
        # to mobile:2021-02-12 if the appropriate feature flag is on:
        if latest == DEFAULT_GROUPING_CONFIG and features.has(
            "organizations:grouping-tree-ui", project.organization, actor=request.user
        ):
            for config in configs:
                config["latest"] = config["id"] == BETA_GROUPING_CONFIG

        return Response(serialize(configs))

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.plugins.base import plugins


@region_silo_endpoint
class ProjectPluginsEndpoint(ProjectEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project) -> Response:
        context = serialize(
            [plugin for plugin in plugins.configurable_for_project(project, version=None)],
            request.user,
            PluginSerializer(project),
        )
        return Response(context)

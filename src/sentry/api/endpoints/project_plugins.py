from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.plugins.base import plugins


class ProjectPluginsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        context = serialize(
            [plugin for plugin in plugins.configurable_for_project(project, version=None)],
            request.user,
            PluginSerializer(project),
        )
        return Response(context)

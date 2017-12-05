from __future__ import absolute_import

from sentry.api.bases.project import ProjectEndpoint
from rest_framework.response import Response
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.plugins import plugins
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import (
    PluginWithConfigSerializer
)


class ProjectPluginResetEndpoint(ProjectEndpoint):
    def _get_plugin(self, plugin_id):
        try:
            return plugins.get(plugin_id)
        except KeyError:
            raise ResourceDoesNotExist

    def post(self, request, project, plugin_id):
        """
        Reset plugin configuration
        """
        plugin = self._get_plugin(plugin_id)

        plugin.reset_options(project=project)

        context = serialize(plugin, request.user, PluginWithConfigSerializer(project))

        return Response(context)

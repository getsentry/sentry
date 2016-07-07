from __future__ import absolute_import

from rest_framework.response import Response
from sentry.plugins import plugins
from sentry.api.bases.project import ProjectEndpoint


class ProjectPluginEndpoint(ProjectEndpoint):
    ACTIONS = ('enable', 'disable', 'configure')

    def _handle(self, request, project, action, slug):
        if action not in self.ACTIONS:
            return Response({'message': 'Unsupported action'})

        try:
            plugin = plugins.get(slug)
        except KeyError:
            return Response({'message': 'Plugin not found'})

        if action == 'configure':
            return plugin.view_configure(request, project)
        elif action == 'disable':
            if plugin.can_disable:
                plugin.disable(project)
                return Response({'message': 'Successfully disabled plugin'})
            else:
                return Response({'message': 'Cannot disable plugin'})

    def get(self, request, project, action, slug):
        return self._handle(request, project, action, slug)

    def post(self, request, project, action, slug):
        return self._handle(request, project, action, slug)


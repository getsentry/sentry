from __future__ import absolute_import

__all__ = ['PluginProjectEndpoint', 'PluginGroupEndpoint']

from sentry.api.bases.group import GroupEndpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models import GroupMeta


class PluginProjectEndpoint(ProjectEndpoint):
    view_method_name = None
    plugin = None

    def _handle(self, request, project, *args, **kwargs):
        return getattr(self.plugin, self.view_method_name)(request, project, *args, **kwargs)

    def get(self, request, project, *args, **kwargs):
        return self._handle(request, project, *args, **kwargs)

    def post(self, request, project, *args, **kwargs):
        return self._handle(request, project, *args, **kwargs)


class PluginGroupEndpoint(GroupEndpoint):
    view_method_name = None
    plugin = None

    def _handle(self, request, group, *args, **kwargs):
        GroupMeta.objects.populate_cache([group])

        return getattr(self.plugin, self.view_method_name)(request, group, *args, **kwargs)

    def get(self, request, group, *args, **kwargs):
        return self._handle(request, group, *args, **kwargs)

    def post(self, request, group, *args, **kwargs):
        return self._handle(request, group, *args, **kwargs)

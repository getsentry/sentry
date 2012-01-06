from sentry.models import Project
from sentry.plugins import Plugin, PluginProxy


class PluginList(object):
    def __init__(self, plugins):
        self.plugins = plugins

    def __getitem__(self, slice):
        return list.__getitem__(self)

    def __iter__(self):
        for p in self.plugins:
            if not p.enabled:
                continue
            yield p


def get_plugins(request, project):
    plugins = []
    for cls in Plugin.plugins.itervalues():
        plugin = PluginProxy(cls(request), project)
        plugins.append(plugin)
    return plugins


class SentryMiddleware(object):
    def process_view(self, request, view_func, view_args, view_kwargs):
        if 'project_id' not in view_kwargs:
            return
        project = Project.objects.get(pk=view_kwargs['project_id'])

        request.plugins = PluginList(get_plugins(request, project))

    def process_response(self, request, response):
        request.plugins = []

        return response

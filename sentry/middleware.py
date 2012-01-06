from sentry.models import Project
from sentry.plugins import Plugin


def get_plugins(request, project):
    plugins = []
    for cls in Plugin.plugins.itervalues():
        plugin = cls(request)
        plugin.configure(project)
        plugins.append(plugin)
    return plugins


class SentryMiddleware(object):
    def process_view(self, request, view_func, view_args, view_kwargs):
        if 'project_id' not in view_kwargs:
            return
        project = Project.objects.get(pk=view_kwargs['project_id'])

        request.plugins = get_plugins(request, project)

    def process_response(self, request, response):
        request.plugins = []

        return response

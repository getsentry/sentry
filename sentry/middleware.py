from sentry.models import Project
from sentry.plugins import Plugin


class PluginList(object):
    def __init__(self, request, project, plugins):
        self._request = request
        self._project = project
        self._plugins = plugins
        self._cache = {}

    def __getitem__(self, slug):
        if slug not in self._cache:
            plugin_cls = self._plugins[slug]
            plugin = plugin_cls(self._request)
            if self._project:
                plugin.configure(self._project)
            self._cache[slug] = plugin

        return self._cache[slug]

    def __iter__(self):
        for plugin in (self[s] for s in self._plugins.iterkeys()):
            if not plugin.enabled:
                continue
            yield plugin

    def for_project(self):
        for slug, plugin_cls in self._plugins.iteritems():
            if not plugin_cls.project_conf_form:
                continue
            yield slug, self[slug].get_title()

    def for_site(self):
        for slug, plugin_cls in self._plugins.iteritems():
            if not plugin_cls.site_conf_form:
                continue
            yield slug, self[slug].get_title()


class SentryMiddleware(object):
    def process_view(self, request, view_func, view_args, view_kwargs):
        if 'project_id' in view_kwargs:
            try:
                project = Project.objects.get(pk=view_kwargs['project_id'])
            except Project.DoesNotExist:
                project = None
        else:
            project = None

        request.plugins = PluginList(request, project, Plugin.plugins)

    def process_response(self, request, response):
        request.plugins = []

        return response

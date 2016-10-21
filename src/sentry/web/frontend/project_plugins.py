from __future__ import absolute_import

from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.plugins import plugins
from sentry.utils.safe import safe_execute
from sentry.web.frontend.base import ProjectView


class ProjectPluginsView(ProjectView):
    required_scope = 'project:write'

    def get_plugins_with_status(self, project):
        return [
            (plugin, safe_execute(plugin.is_enabled, project, _with_transaction=False))
            for plugin in plugins.configurable_for_project(project, version=None)
        ]

    def handle(self, request, organization, team, project, **kwargs):
        plugin_type = kwargs.get('type')
        if request.POST:
            enabled = set(request.POST.getlist('plugin'))
            _plugins = plugins.configurable_for_project(project, version=None)
            if plugin_type:
                _plugins = [p for p in _plugins if p.get_plugin_type() == plugin_type]
            for plugin in _plugins:
                if plugin.slug in enabled:
                    plugin.enable(project)
                else:
                    plugin.disable(project)

            messages.add_message(
                request, messages.SUCCESS,
                _('Your settings were saved successfully.'))

            return self.redirect(request.path)

        _plugins = self.get_plugins_with_status(project)
        if plugin_type:
            _plugins = [
                p for p in _plugins if p[0].get_plugin_type() == plugin_type
            ]

        context = {
            'page': plugin_type or 'plugins',
            'plugins_with_status': _plugins
        }

        return self.respond('sentry/projects/plugins/list.html', context)

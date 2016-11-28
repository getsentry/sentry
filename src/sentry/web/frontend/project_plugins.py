from __future__ import absolute_import

from django.contrib import messages
from django.http import HttpResponseRedirect

from sentry import constants
from sentry.plugins import (
    plugins, IssueTrackingPlugin,
    IssueTrackingPlugin2, NotificationPlugin
)
from sentry.signals import plugin_enabled
from sentry.utils.safe import safe_execute
from sentry.web.frontend.base import ProjectView


class ProjectPluginsView(ProjectView):
    required_scope = 'project:write'

    def get_plugins_with_status(self, project):
        return [
            (plugin, safe_execute(plugin.is_enabled, project, _with_transaction=False))
            for plugin in plugins.configurable_for_project(project, version=None)
        ]

    def _handle_enable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.enable(project)

        if isinstance(plugin, IssueTrackingPlugin) or \
                isinstance(plugin, IssueTrackingPlugin2) or \
                isinstance(plugin, NotificationPlugin):
            plugin_enabled.send(plugin=plugin, project=project, user=request.user, sender=self)
        messages.add_message(
            request, messages.SUCCESS,
            constants.OK_PLUGIN_ENABLED.format(name=plugin.get_title()),
        )

    def _handle_disable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])

        if not plugin.can_disable:
            messages.add_message(
                request, messages.ERROR,
                'This integration is always enabled.'
            )
            return

        plugin.disable(project)
        messages.add_message(
            request, messages.SUCCESS,
            constants.OK_PLUGIN_DISABLED.format(name=plugin.get_title()),
        )

    def handle(self, request, organization, team, project, **kwargs):
        if request.method == 'POST':
            op = request.POST.get('op')
            if op == 'enable':
                self._handle_enable_plugin(request, project)
                return HttpResponseRedirect(request.path)
            elif op == 'disable':
                self._handle_disable_plugin(request, project)
                return HttpResponseRedirect(request.path)

        plugin_type = kwargs.get('type')
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

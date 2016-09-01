from __future__ import absolute_import

from django.contrib import messages
from django.http import HttpResponseRedirect, HttpResponse
from django.utils.safestring import mark_safe

from sentry import constants
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.plugins import plugins, IssueTrackingPlugin, IssueTrackingPlugin2
from sentry.signals import plugin_enabled
from sentry.web.frontend.base import ProjectView


class ProjectIssueTrackingView(ProjectView):
    required_scope = 'project:write'

    def _iter_plugins(self):
        for plugin in plugins.all(version=1):
            if not (isinstance(plugin, IssueTrackingPlugin)
                    or isinstance(plugin, IssueTrackingPlugin2)):
                continue
            yield plugin

    def _handle_enable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.enable(project)

        plugin_enabled.send(plugin=plugin, project=project, user=request.user, sender=self)

        messages.add_message(
            request, messages.SUCCESS,
            constants.OK_PLUGIN_ENABLED.format(name=plugin.get_title()),
        )

    def _handle_disable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.disable(project)
        messages.add_message(
            request, messages.SUCCESS,
            constants.OK_PLUGIN_DISABLED.format(name=plugin.get_title()),
        )

    def handle(self, request, organization, team, project):
        if request.method == 'POST':
            op = request.POST.get('op')
            if op == 'enable':
                self._handle_enable_plugin(request, project)
                return HttpResponseRedirect(request.path)
            elif op == 'disable':
                self._handle_disable_plugin(request, project)
                return HttpResponseRedirect(request.path)

        enabled_plugins = []
        other_plugins = []
        issue_v2_plugins = []
        for plugin in self._iter_plugins():
            if plugin.is_enabled(project):
                if isinstance(plugin, IssueTrackingPlugin2):
                    issue_v2_plugins.append(plugin)
                    continue
                content = plugin.get_issue_doc_html()

                form = plugin.project_conf_form
                if form is not None:
                    view = plugin.configure(request=request, project=project)
                    if isinstance(view, HttpResponse):
                        return view
                elif content:
                    enabled_plugins.append((plugin, mark_safe(content)))
                enabled_plugins.append((plugin, mark_safe(content + view)))
            elif plugin.can_configure_for_project(project):
                other_plugins.append(plugin)

        context = {
            'page': 'issue-tracking',
            'enabled_plugins': enabled_plugins,
            'other_plugins': other_plugins,
            'issue_v2_plugins': serialize(
                issue_v2_plugins, request.user, PluginSerializer(
                    project=project
                )
            ),
        }

        return self.respond('sentry/project-issue-tracking.html', context)

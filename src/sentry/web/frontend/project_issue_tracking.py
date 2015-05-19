from __future__ import absolute_import

from django.contrib import messages
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe

from sentry import constants
from sentry.models import OrganizationMemberType
from sentry.plugins import plugins, IssueTrackingPlugin
from sentry.web.frontend.base import ProjectView
from sentry.web.helpers import plugin_config


class ProjectIssueTrackingView(ProjectView):
    required_access = OrganizationMemberType.ADMIN

    def _iter_plugins(self):
        for plugin in plugins.all(version=1):
            if not isinstance(plugin, IssueTrackingPlugin):
                continue
            yield plugin

    def _handle_enable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.set_option('enabled', True, project)
        messages.add_message(
            request, messages.SUCCESS,
            constants.OK_PLUGIN_ENABLED.format(name=plugin.get_title()),
        )

    def _handle_disable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.set_option('enabled', False, project)
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
        for plugin in self._iter_plugins():
            if plugin.is_enabled(project):
                content = plugin.get_issue_doc_html()

                form = plugin.project_conf_form
                if form is not None:
                    action, view = plugin_config(plugin, project, request)
                    if action == 'redirect':
                        messages.add_message(
                            request, messages.SUCCESS,
                            constants.OK_PLUGIN_SAVED.format(name=plugin.get_title()),
                        )
                        return HttpResponseRedirect(request.path)
                elif content:
                    enabled_plugins.append((plugin, mark_safe(content)))
                enabled_plugins.append((plugin, mark_safe(content + view)))
            else:
                other_plugins.append(plugin)

        context = {
            'page': 'issue-tracking',
            'enabled_plugins': enabled_plugins,
            'other_plugins': other_plugins,
        }

        return self.respond('sentry/project-issue-tracking.html', context)

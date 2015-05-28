from __future__ import absolute_import

from django.conf import settings
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry import constants
from sentry.models import OrganizationMemberType
from sentry.plugins import plugins, NotificationPlugin
from sentry.web.forms.projects import NotificationSettingsForm
from sentry.web.frontend.base import ProjectView
from sentry.web.helpers import plugin_config

OK_SETTINGS_SAVED = _('Your settings were saved successfully.')


class ProjectNotificationsView(ProjectView):
    required_access = OrganizationMemberType.ADMIN

    def _iter_plugins(self):
        for plugin in plugins.all(version=1):
            if not isinstance(plugin, NotificationPlugin):
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
        op = request.POST.get('op')
        if op == 'enable':
            self._handle_enable_plugin(request, project)
            return HttpResponseRedirect(request.path)
        elif op == 'disable':
            self._handle_disable_plugin(request, project)
            return HttpResponseRedirect(request.path)

        if op == 'save-settings':
            general_form = NotificationSettingsForm(
                data=request.POST,
                prefix='general',
                initial={
                    'subject_prefix': project.get_option(
                        'mail:subject_prefix', settings.EMAIL_SUBJECT_PREFIX),
                },
            )
            if general_form.is_valid():
                project.update_option(
                    'mail:subject_prefix', general_form.cleaned_data['subject_prefix'])
                messages.add_message(
                    request, messages.SUCCESS,
                    OK_SETTINGS_SAVED)
                return HttpResponseRedirect(request.path)
        else:
            general_form = NotificationSettingsForm(
                prefix='general',
                initial={
                    'subject_prefix': project.get_option(
                        'mail:subject_prefix', settings.EMAIL_SUBJECT_PREFIX),
                },
            )

        enabled_plugins = []
        other_plugins = []
        for plugin in self._iter_plugins():
            if plugin.is_enabled(project):
                content = plugin.get_notification_doc_html()

                form = plugin.project_conf_form
                if form is not None:
                    action, view = plugin_config(plugin, project, request)
                    if action == 'redirect':
                        messages.add_message(
                            request, messages.SUCCESS,
                            constants.OK_PLUGIN_SAVED.format(name=plugin.get_title()),
                        )
                        return HttpResponseRedirect(request.path)
                    enabled_plugins.append((plugin, mark_safe(content + view)))
                elif content:
                    enabled_plugins.append((plugin, mark_safe(content)))
            else:
                other_plugins.append(plugin)

        context = {
            'page': 'notifications',
            'enabled_plugins': enabled_plugins,
            'other_plugins': other_plugins,
            'general_form': general_form,
        }

        return self.respond('sentry/project-notifications.html', context)

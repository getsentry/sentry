from __future__ import absolute_import

from django.contrib import messages
from django.http import HttpResponseRedirect, HttpResponse
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry import constants
from sentry import options
from sentry.app import digests
from sentry.digests import get_option_key as get_digest_option_key
from sentry.plugins import plugins, NotificationPlugin
from sentry.web.forms.projects import (
    DigestSettingsForm,
    NotificationSettingsForm,
)
from sentry.web.frontend.base import ProjectView

OK_SETTINGS_SAVED = _('Your settings were saved successfully.')


class ProjectNotificationsView(ProjectView):
    required_scope = 'project:write'

    def _iter_plugins(self):
        for plugin in plugins.all(version=1):
            if not isinstance(plugin, NotificationPlugin):
                continue
            yield plugin

    def _handle_enable_plugin(self, request, project):
        plugin = plugins.get(request.POST['plugin'])
        plugin.enable(project)

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
        op = request.POST.get('op')
        if op == 'enable':
            self._handle_enable_plugin(request, project)
            return HttpResponseRedirect(request.path)
        elif op == 'disable':
            self._handle_disable_plugin(request, project)
            return HttpResponseRedirect(request.path)

        if op == 'save-settings':
            if digests.enabled(project):
                digests_form = DigestSettingsForm(
                    data=request.POST,
                    prefix='digests',
                    initial={
                        'minimum_delay': project.get_option(
                            get_digest_option_key('mail', 'minimum_delay'),
                            digests.minimum_delay / 60,
                        ),
                        'maximum_delay': project.get_option(
                            get_digest_option_key('mail', 'maximum_delay'),
                            digests.maximum_delay / 60,
                        ),
                    },
                )
            else:
                digests_form = None

            general_form = NotificationSettingsForm(
                data=request.POST,
                prefix='general',
                initial={
                    'subject_prefix': project.get_option(
                        'mail:subject_prefix', options.get('mail.subject-prefix')),
                },
            )
            if general_form.is_valid() and (digests_form.is_valid() if digests_form is not None else True):
                project.update_option('mail:subject_prefix', general_form.cleaned_data['subject_prefix'])
                if digests_form is not None:
                    project.update_option(
                        get_digest_option_key('mail', 'minimum_delay'),
                        digests_form.cleaned_data['minimum_delay'] * 60,
                    )
                    project.update_option(
                        get_digest_option_key('mail', 'maximum_delay'),
                        digests_form.cleaned_data['maximum_delay'] * 60,
                    )
                messages.add_message(
                    request, messages.SUCCESS,
                    OK_SETTINGS_SAVED)
                return HttpResponseRedirect(request.path)
        else:
            if digests.enabled(project):
                digests_form = DigestSettingsForm(
                    prefix='digests',
                    initial={
                        'minimum_delay': project.get_option(
                            get_digest_option_key('mail', 'minimum_delay'),
                            digests.minimum_delay,
                        ) / 60,
                        'maximum_delay': project.get_option(
                            get_digest_option_key('mail', 'maximum_delay'),
                            digests.maximum_delay,
                        ) / 60,
                    },
                )
            else:
                digests_form = None

            general_form = NotificationSettingsForm(
                prefix='general',
                initial={
                    'subject_prefix': project.get_option(
                        'mail:subject_prefix', options.get('mail.subject-prefix')),
                },
            )

        enabled_plugins = []
        other_plugins = []
        for plugin in self._iter_plugins():
            if plugin.is_enabled(project):
                content = plugin.get_notification_doc_html()

                form = plugin.project_conf_form
                if form is not None:
                    view = plugin.configure(request, project=project)
                    if isinstance(view, HttpResponse):
                        return view
                    enabled_plugins.append((plugin, mark_safe(content + view)))
                elif content:
                    enabled_plugins.append((plugin, mark_safe(content)))
            elif plugin.can_configure_for_project(project):
                other_plugins.append(plugin)

        context = {
            'page': 'notifications',
            'enabled_plugins': enabled_plugins,
            'other_plugins': other_plugins,
            'general_form': general_form,
            'digests_form': digests_form,
        }

        return self.respond('sentry/project-notifications.html', context)

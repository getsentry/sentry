from __future__ import absolute_import

from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.plugins import plugins
from sentry.web.frontend.base import ProjectView

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember
)


class ProjectPluginsView(ProjectView):
    required_scope = 'project:write'

    def handle(self, request, organization, team, project):
        if request.POST:
            enabled = set(request.POST.getlist('plugin'))
            member = OrganizationMember.objects.get(
                user=request.user,
                organization=organization,
            )
            disabled_list = []
            enabled_list = []

            for plugin in plugins.configurable_for_project(project, version=None):
                if plugin.slug in enabled:
                    if not plugin.is_enabled(project):
                        enabled_list.append(plugin)
                    plugin.enable(project)
                else:
                    if plugin.is_enabled(project):
                        disabled_list.append(plugin)
                    plugin.disable(project)

            for plugin in enabled_list:
                AuditLogEntry.objects.create(
                    organization=organization,
                    actor=request.user,
                    ip_address=request.META['REMOTE_ADDR'],
                    target_object=member.id,
                    target_user=request.user,
                    event=AuditLogEntryEvent.PLUGIN_ADD,
                    data=member.get_audit_log_data(),
                )

            for plugin in disabled_list:
                AuditLogEntry.objects.create(
                    organization=organization,
                    actor=request.user,
                    ip_address=request.META['REMOTE_ADDR'],
                    target_object=member.id,
                    target_user=request.user,
                    event=AuditLogEntryEvent.PLUGIN_REMOVE,
                    data=member.get_audit_log_data(),
                )

            messages.add_message(
                request, messages.SUCCESS,
                _('Your settings were saved successfully.'))

            return self.redirect(request.path)

        context = {
            'page': 'plugins',
        }

        return self.respond('sentry/projects/plugins/list.html', context)

from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Project, ProjectStatus,
    OrganizationMemberType
)
from sentry.permissions import can_remove_project
from sentry.tasks.deletion import delete_project
from sentry.web.frontend.base import ProjectView


class RemoveProjectForm(forms.Form):
    pass


class RemoveProjectView(ProjectView):
    required_access = OrganizationMemberType.OWNER
    sudo_required = True

    def get_form(self, request):
        if request.method == 'POST':
            return RemoveProjectForm(request.POST)
        return RemoveProjectForm()

    def get(self, request, organization, team, project):
        if not can_remove_project(request.user, project):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request)

        context = {
            'form': form,
        }

        return self.respond('sentry/projects/remove.html', context)

    def post(self, request, organization, team, project):
        if not can_remove_project(request.user, project):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request)

        if form.is_valid():
            updated = Project.objects.filter(
                id=project.id,
                status=ProjectStatus.VISIBLE,
            ).update(status=ProjectStatus.PENDING_DELETION)
            if updated:
                delete_project.delay(object_id=project.id)

                AuditLogEntry.objects.create(
                    organization=organization,
                    actor=request.user,
                    ip_address=request.META['REMOTE_ADDR'],
                    target_object=project.id,
                    event=AuditLogEntryEvent.PROJECT_REMOVE,
                    data=project.get_audit_log_data(),
                )

            messages.add_message(
                request, messages.SUCCESS,
                _(u'The project %r was scheduled for deletion.') % (project.name.encode('utf-8'),))

            return HttpResponseRedirect(reverse('sentry-organization-home', args=[team.organization.id]))

        context = {
            'form': form,
        }

        return self.respond('sentry/projects/remove.html', context)

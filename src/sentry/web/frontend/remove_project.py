from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.constants import STATUS_HIDDEN
from sentry.models import OrganizationMemberType
from sentry.permissions import can_remove_project
from sentry.tasks.deletion import delete_project
from sentry.web.frontend.base import ProjectView


class RemoveProjectForm(forms.Form):
    pass


class RemoveProjectView(ProjectView):
    required_access = OrganizationMemberType.ADMIN
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
            if project.status != STATUS_HIDDEN:
                project.update(status=STATUS_HIDDEN)
                delete_project.delay(object_id=project.id)

            messages.add_message(
                request, messages.SUCCESS,
                _('Deletion has been queued and will happen automatically.'))

            return HttpResponseRedirect(reverse('sentry-manage-team-projects', args=[team.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/projects/remove.html', context)

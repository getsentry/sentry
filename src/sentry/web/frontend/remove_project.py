from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.api import client
from sentry.web.frontend.base import ProjectView


class RemoveProjectForm(forms.Form):
    pass


class RemoveProjectView(ProjectView):
    required_scope = 'project:delete'
    sudo_required = True

    def get_form(self, request):
        if request.method == 'POST':
            return RemoveProjectForm(request.POST)
        return RemoveProjectForm()

    def handle(self, request, organization, team, project):
        form = self.get_form(request)

        if form.is_valid():
            client.delete('/projects/{}/{}/'.format(organization.slug, project.slug),
                          request=request, is_sudo=True)

            messages.add_message(
                request, messages.SUCCESS,
                _(u'The project %r was scheduled for deletion.') % (project.name.encode('utf-8'),))

            return HttpResponseRedirect(reverse('sentry-organization-home', args=[team.organization.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/projects/remove.html', context)

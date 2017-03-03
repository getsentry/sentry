from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.api import client
from sentry.web.frontend.base import TeamView


class RemoveTeamForm(forms.Form):
    pass


class RemoveTeamView(TeamView):
    required_scope = 'team:delete'
    sudo_required = True

    def get_form(self, request):
        if request.method == 'POST':
            return RemoveTeamForm(request.POST)
        return RemoveTeamForm(None)

    def handle(self, request, organization, team):
        form = self.get_form(request)

        if form.is_valid():
            client.delete('/teams/{}/{}/'.format(organization.slug, team.slug),
                          request=request, is_sudo=True)

            messages.add_message(
                request, messages.SUCCESS,
                _(u'The team %r was scheduled for deletion.') % (team.name.encode('utf-8'),))

            return HttpResponseRedirect(reverse('sentry'))

        context = {
            'form': form,
            'project_list': team.project_set.all(),
        }

        return self.respond('sentry/teams/remove.html', context)

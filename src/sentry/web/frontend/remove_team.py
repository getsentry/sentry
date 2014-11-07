from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import OrganizationMemberType, TeamStatus
from sentry.permissions import can_remove_team
from sentry.tasks.deletion import delete_team
from sentry.web.frontend.base import TeamView


class RemoveTeamForm(forms.Form):
    pass


class RemoveTeamView(TeamView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request):
        if request.method == 'POST':
            return RemoveTeamForm(request.POST)
        return RemoveTeamForm(None)

    def get(self, request, organization, team):
        form = self.get_form(request)

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/remove.html', context)

    def post(self, request, organization, team):
        if not can_remove_team(request.user, team):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request)

        if form.is_valid():
            team.update(status=TeamStatus.PENDING_DELETION)

            delete_team.delay(object_id=team.id)

            messages.add_message(
                request, messages.SUCCESS,
                _(u'The team %r was scheduled for deletion.') % (team.name.encode('utf-8'),))

            return HttpResponseRedirect(reverse('sentry'))

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/remove.html', context)

from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import TeamMemberType, TeamMember
from sentry.permissions import can_edit_team_member
from sentry.web.forms.fields import UserField
from sentry.web.frontend.base import TeamView


class EditTeamMemberForm(forms.ModelForm):
    user = UserField()

    class Meta:
        fields = ('type', 'user')
        model = TeamMember

    def __init__(self, team, *args, **kwargs):
        self.team = team
        super(EditTeamMemberForm, self).__init__(*args, **kwargs)

    def clean_user(self):
        value = self.cleaned_data['user']
        if not value:
            return None

        if self.team.member_set.filter(user=value).exists():
            raise forms.ValidationError(_('User is already a member of this team'))

        return value


class TeamMemberSettingsView(TeamView):
    required_access = TeamMemberType.ADMIN

    def get_form(self, request, team):
        initial = {
            'type': TeamMemberType.MEMBER,
        }

        return EditTeamMemberForm(team, request.POST or None, initial=initial)

    def get(self, request, organization, team, member_id):
        try:
            member = team.member_set.get(pk=member_id)
        except TeamMember.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

        if member.user == team.owner:
            return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

        if not can_edit_team_member(request.user, member):
            return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

        form = self.get_form(request, team)

        context = {
            'member': member,
            'form': form,
        }

        return self.respond('sentry/teams/members/edit.html', context)

    def post(self, request, organization, team, member_id):
        try:
            member = team.member_set.get(pk=member_id)
        except TeamMember.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

        if member.user == team.owner:
            return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

        if not can_edit_team_member(request.user, member):
            return HttpResponseRedirect(reverse('sentry-manage-team', args=[team.slug]))

        form = self.get_form(request, team)
        if form.is_valid():
            member = form.save()

            messages.add_message(request, messages.SUCCESS,
                _('Changes to your team member were saved.'))

            return HttpResponseRedirect(request.path)

        context = {
            'member': member,
            'form': form,
        }

        return self.respond('sentry/teams/members/edit.html', context)

from __future__ import absolute_import

from django import forms
from django.conf import settings
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import PendingTeamMember, TeamMemberType, TeamMember
from sentry.permissions import can_add_team_member
from sentry.web.forms.fields import UserField
from sentry.web.frontend.base import TeamView


class InviteTeamMemberForm(forms.ModelForm):
    class Meta:
        fields = ('type', 'email')
        model = PendingTeamMember

    def __init__(self, team, *args, **kwargs):
        self.team = team
        super(InviteTeamMemberForm, self).__init__(*args, **kwargs)

    def clean_email(self):
        value = self.cleaned_data['email']
        if not value:
            return None

        if self.team.member_set.filter(user__email__iexact=value).exists():
            raise forms.ValidationError(_('There is already a member with this email address'))

        if self.team.pending_member_set.filter(email__iexact=value).exists():
            raise forms.ValidationError(_('There is already a pending invite for this user'))

        return value


class NewTeamMemberForm(forms.ModelForm):
    user = UserField()

    class Meta:
        fields = ('type', 'user')
        model = TeamMember

    def __init__(self, team, *args, **kwargs):
        self.team = team
        super(NewTeamMemberForm, self).__init__(*args, **kwargs)

    def clean_user(self):
        value = self.cleaned_data['user']
        if not value:
            return None

        if self.team.member_set.filter(user=value).exists():
            raise forms.ValidationError(_('User is already a member of this team'))

        return value


class CreateTeamMemberView(TeamView):
    required_access = TeamMemberType.ADMIN

    def get_form(self, request, team):
        initial = {
            'type': TeamMemberType.MEMBER,
        }

        if settings.SENTRY_ENABLE_INVITES:
            form_cls = InviteTeamMemberForm
        else:
            form_cls = NewTeamMemberForm

        return form_cls(team, request.POST or None, initial=initial)

    def get(self, request, organization, team):
        if not can_add_team_member(request.user, team):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request, team)

        context = {
            'form': form,
            'is_invite': settings.SENTRY_ENABLE_INVITES,
        }

        return self.respond('sentry/teams/members/new.html', context)

    def post(self, request, organization, team):
        if not can_add_team_member(request.user, team):
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request, team)
        if form.is_valid():
            pm = form.save(commit=False)
            pm.team = team
            pm.save()

            messages.add_message(request, messages.SUCCESS,
                _('The team member was added.'))

            return HttpResponseRedirect(reverse('sentry-manage-team-members', args=[team.slug]))

        context = {
            'form': form,
            'is_invite': settings.SENTRY_ENABLE_INVITES,
        }

        return self.respond('sentry/teams/members/new.html', context)

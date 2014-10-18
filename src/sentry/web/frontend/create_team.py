from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import OrganizationMemberType, Team
from sentry.permissions import can_create_teams, Permissions
from sentry.web.frontend.base import OrganizationView
from sentry.web.frontend.generic import missing_perm


class NewTeamForm(forms.ModelForm):
    name = forms.CharField(label=_('Team Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('example.com')}))

    class Meta:
        fields = ('name',)
        model = Team


class CreateTeamView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request):
        return NewTeamForm(request.POST or None)

    def get(self, request, organization):
        if not can_create_teams(request.user):
            return missing_perm(request, Permissions.ADD_TEAM)

        form = self.get_form(request)

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/new.html', context)

    def post(self, request, organization):
        if not can_create_teams(request.user):
            return missing_perm(request, Permissions.ADD_TEAM)

        form = self.get_form(request)
        if form.is_valid():
            team = form.save(commit=False)
            team.organization = organization
            team.owner = organization.owner
            team.save()
            return HttpResponseRedirect(reverse('sentry-new-project', args=[team.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/new.html', context)

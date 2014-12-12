from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import OrganizationMemberType, Project, Team
from sentry.permissions import can_create_teams, Permissions
from sentry.web.frontend.base import OrganizationView
from sentry.web.frontend.generic import missing_perm

BLANK_CHOICE = [("", "")]


class NewTeamForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('e.g. Website')}))

    class Meta:
        fields = ('name',)
        model = Team


class NewProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('e.g. Backend')}))
    platform = forms.ChoiceField(
        choices=Project._meta.get_field('platform').get_choices(blank_choice=BLANK_CHOICE),
        widget=forms.Select(attrs={'data-placeholder': _('Select a platform')}),
        help_text='Your platform choices helps us setup some defaults for this project.',
    )

    class Meta:
        fields = ('name', 'platform')
        model = Project


class CreateTeamView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def handle(self, request, organization):
        if not can_create_teams(request.user, organization):
            return missing_perm(request, Permissions.ADD_TEAM)

        team_form = NewTeamForm(request.POST or None, prefix='team_')
        project_form = NewProjectForm(request.POST or None, prefix='project_')

        all_forms = [team_form, project_form]

        if all(f.is_valid() for f in all_forms):
            team = team_form.save(commit=False)
            team.organization = organization
            team.owner = organization.owner
            team.save()

            project = project_form.save(commit=False)
            project.team = team
            project.organization = organization
            project.save()

            if project.platform not in (None, 'other'):
                url = reverse('sentry-docs-client', args=[organization.slug, project.slug, project.platform])
            else:
                url = reverse('sentry-get-started', args=[organization.slug, project.slug])

            return HttpResponseRedirect(url)

        context = {
            'team_form': team_form,
            'project_form': project_form,
        }

        return self.respond('sentry/create-team.html', context)

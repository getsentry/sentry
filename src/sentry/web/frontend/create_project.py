from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import Project, OrganizationMemberType, Team
from sentry.web.frontend.base import OrganizationView
from sentry.utils.samples import create_sample_event

BLANK_CHOICE = [("", "")]


class NewProjectForm(forms.ModelForm):
    team = forms.ChoiceField(choices=(), required=True)
    name = forms.CharField(label=_('Project Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('Production')}))
    platform = forms.ChoiceField(
        choices=Project._meta.get_field('platform').get_choices(blank_choice=BLANK_CHOICE),
        widget=forms.Select(attrs={'data-placeholder': _('Select a platform')})
    )

    class Meta:
        fields = ('name', 'team', 'platform')
        model = Project

    def __init__(self, user, team_list, *args, **kwargs):
        super(NewProjectForm, self).__init__(*args, **kwargs)

        self.team_list = team_list

        self.fields['team'].choices = (
            (t.slug, t.name)
            for t in team_list
        )
        self.fields['team'].widget.choices = self.fields['team'].choices

    def clean_team(self):
        value = self.cleaned_data['team']
        for team in self.team_list:
            if value == team.slug:
                return team
        return None


class CreateProjectView(OrganizationView):
    # TODO(dcramer): I'm 95% certain the access is incorrect here as it would
    # be probably validating against global org access, and all we care about is
    # team admin
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request, organization):
        team_list = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
            access=OrganizationMemberType.ADMIN,
        )

        return NewProjectForm(request.user, team_list, request.POST or None)

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            project = form.save(commit=False)
            project.organization = organization
            project.save()

            create_sample_event(project)

            if project.platform not in (None, 'other'):
                url = reverse('sentry-docs-client', args=[project.team.slug, project.slug, project.platform])
            else:
                url = reverse('sentry-get-started', args=[project.team.slug, project.slug])
            return HttpResponseRedirect(url)

        context = {
            'form': form,
        }

        return self.respond('sentry/create-project.html', context)

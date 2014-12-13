from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse

from sentry.models import OrganizationMemberType, Project, Team
from sentry.web.forms.add_project import AddProjectForm
from sentry.web.frontend.base import OrganizationView


class AddProjectWithTeamForm(AddProjectForm):
    team = forms.ChoiceField(choices=(), required=True)

    class Meta:
        fields = ('name', 'team', 'platform')
        model = Project

    def __init__(self, user, team_list, *args, **kwargs):
        super(AddProjectWithTeamForm, self).__init__(*args, **kwargs)

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

    def save(self, actor, ip_address):
        team = self.cleaned_data['team']
        return super(AddProjectWithTeamForm, self).save(actor, team, ip_address)


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

        return AddProjectWithTeamForm(request.user, team_list, request.POST or None, initial={
            'team': request.GET.get('team'),
        })

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            project = form.save(request.user, request.META['REMOTE_ADDR'])

            url = reverse('sentry-stream', args=[organization.slug, project.slug])

            return self.redirect(url + '?newinstall=1')

        context = {
            'form': form,
        }

        return self.respond('sentry/create-project.html', context)

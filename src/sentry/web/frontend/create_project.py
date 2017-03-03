from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse

from sentry.api import client
from sentry.models import Project, Team
from sentry.web.forms.add_project import AddProjectForm
from sentry.web.frontend.base import OrganizationView
from sentry.utils.http import absolute_uri


ERR_NO_TEAMS = 'You cannot create a new project because there are no teams to assign it to.'


class AddProjectWithTeamForm(AddProjectForm):
    team = forms.ChoiceField(
        choices=(), required=True,
        help_text='The team controls who has access to this project.',
    )

    class Meta:
        fields = ('name', 'team')
        model = Project

    def __init__(self, user, organization, team_list, *args, **kwargs):
        super(AddProjectWithTeamForm, self).__init__(organization, *args, **kwargs)

        self.team_list = team_list

        if len(self.team_list) == 1:
            del self.fields['team']
        else:
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
        team = self.cleaned_data.get('team', self.team_list[0])
        return super(AddProjectWithTeamForm, self).save(actor, team, ip_address)


class CreateProjectView(OrganizationView):
    # While currently the UI suggests teams are a parent of a project, in reality
    # the project is the core component, and which team it is on is simply an
    # attribute. Because you can already change the team of a project via mutating
    # it, and because Sentry intends to remove teams as a hierarchy item, we
    # allow you to view a teams projects, as well as create a new project as long
    # as you are a member of that team and have project scoped permissions.
    required_scope = 'project:write'

    def get_form(self, request, organization, team_list):
        data = {
            'team': request.GET.get('team'),
        }
        return AddProjectWithTeamForm(request.user, organization, team_list,
                                      request.POST or None, initial=data)

    def handle(self, request, organization):
        team_list = [
            t for t in Team.objects.get_for_user(
                organization=organization,
                user=request.user,
            )
            if request.access.has_team_scope(t, self.required_scope)
        ]
        if not team_list:
            messages.error(request, ERR_NO_TEAMS)
            return self.redirect(reverse('sentry-organization-home', args=[organization.slug]))

        form = self.get_form(request, organization, team_list)
        if form.is_valid():
            team = form.cleaned_data.get('team', team_list[0])

            response = client.post('/teams/{}/{}/projects/'.format(
                organization.slug,
                team.slug,
            ), data={
                'name': form.cleaned_data['name'],
            }, request=request)

            install_uri = absolute_uri('/{}/{}/getting-started/'.format(
                organization.slug,
                response.data['slug'],
            ))

            if 'signup' in request.GET:
                install_uri += '?signup'

            return self.redirect(install_uri)

        context = {
            'form': form,
        }

        return self.respond('sentry/create-project.html', context)

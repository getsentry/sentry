from __future__ import absolute_import

from django import forms
from sentry.web.frontend.base import BaseView
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, Http404
from sentry.models import OrganizationMember, Organization, Team, Project


class AcceptProjectTransferForm(forms.Form):
    team = forms.ChoiceField(choices=[])

    def __init__(self, request, *args, **kwargs):
        super(AcceptProjectTransferForm, self).__init__(*args, **kwargs)
        teams = []
        for o in OrganizationMember.objects.filter(user__email=request.user):
            org_name = Organization.objects.get(id=o.organization_id).name
            for t in o.get_teams():
                option = " %s - %s" % (t.name, org_name)
                teams.append([t.id, option])

        self.fields['team'].choices = teams
        self.fields['team'].widget.choices = self.fields['team'].choices


class AcceptProjectTransferView(BaseView):
        required_scope = 'org:admin'
        sudo_required = True

        def get_form(self, request):
            if request.method == 'POST':
                return AcceptProjectTransferForm(request, request.POST, initial=request.POST)
            return AcceptProjectTransferForm(request)

        def handle(self, request, *args, **kwargs):
            try:
                project_id = request.GET['project_id']
            except KeyError:
                raise Http404

            form = self.get_form(request)
            if form.is_valid():
                # transfer the project
                team_id = form.cleaned_data.get('team')
                new_team = Team.objects.get(id=team_id)
                project = Project.objects.get(id=project_id)
                project.team = new_team
                project.organization = new_team.organization
                project.save()

                return HttpResponseRedirect(reverse('sentry-organization-home', args=[new_team.organization.slug]))

            context = {
                'project': Project.objects.get(id=project_id),
                'form': form,
            }
            return self.respond('sentry/projects/accept_project_transfer.html', context)

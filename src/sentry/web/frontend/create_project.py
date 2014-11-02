from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import Project, OrganizationMemberType
from sentry.permissions import can_create_projects, Permissions
from sentry.web.frontend.base import TeamView
from sentry.web.frontend.generic import missing_perm
from sentry.utils.samples import create_sample_event

BLANK_CHOICE = [("", "")]


class NewProjectForm(forms.ModelForm):
    name = forms.CharField(label=_('Project Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('Production')}))
    platform = forms.ChoiceField(
        choices=Project._meta.get_field('platform').get_choices(blank_choice=BLANK_CHOICE),
        widget=forms.Select(attrs={'data-placeholder': _('Select a platform')})
    )

    class Meta:
        fields = ('name', 'platform')
        model = Project


class CreateProjectView(TeamView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request):
        return NewProjectForm(request.POST or None)

    def get(self, request, organization, team):
        if not can_create_projects(request.user, team):
            return missing_perm(request, Permissions.ADD_PROJECT, team=team)

        form = self.get_form(request)

        context = {
            'form': form,
        }

        return self.respond('sentry/teams/projects/new.html', context)

    def post(self, request, organization, team):
        if not can_create_projects(request.user, team):
            return missing_perm(request, Permissions.ADD_PROJECT, team=team)

        form = self.get_form(request)
        if form.is_valid():
            project = form.save(commit=False)
            project.team = team
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

        return self.respond('sentry/teams/projects/new.html', context)

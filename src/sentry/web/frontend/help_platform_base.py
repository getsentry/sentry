from __future__ import absolute_import

from django.db.models import Q
from itertools import groupby

from sentry.models import Project, ProjectKey
from sentry.web.frontend.base import BaseView


class HelpPlatformBaseView(BaseView):
    auth_required = False

    def get_project_list(self, user):
        return list(Project.objects.filter(
            Q(organization__member_set__has_global_access=True, organization__member_set__user=user)
            | Q(team__organizationmember__user=user)
        ).select_related('team', 'organization').order_by('organization', 'team'))

    def group_project_list(self, project_list):
        results = []
        for org, org_project_list in groupby(project_list, key=lambda x: x.organization):
            org_results = []
            for team, team_project_list in groupby(list(org_project_list), key=lambda x: x.team):
                org_results.append((team, list(team_project_list)))
            results.append((org, org_results))
        return results

    def get_key(self, project, user):
        try:
            key = ProjectKey.objects.filter(user=None, project=project)[0]
        except IndexError:
            try:
                key = ProjectKey.objects.filter(user=user, project=project)[0]
            except IndexError:
                key = None

        return key

    def convert_args(self, request, *args, **kwargs):
        try:
            pid = int(request.GET.get('pid', request.session.get('pid', 0)))
        except (TypeError, ValueError):
            pid = None

        if request.user.is_authenticated():
            project_list = self.get_project_list(request.user)
        else:
            project_list = []

        if pid:
            for project in project_list:
                if pid == project.id:
                    selected_project = project
                    break
            else:
                selected_project = None
        else:
            selected_project = None

        if selected_project:
            request.session['pid'] = selected_project.id

        kwargs['project_list'] = project_list
        kwargs['selected_project'] = selected_project

        return (args, kwargs)

    def get_context_data(self, request, project_list, selected_project, **kwargs):
        context = super(HelpPlatformBaseView, self).get_context_data(request, **kwargs)

        if selected_project:
            key = self.get_key(selected_project, request.user)
        else:
            key = None

        if key:
            dsn_private = key.dsn_private
            dsn_public = key.dsn_public
        else:
            dsn_private = None
            dsn_public = None

        context = {
            'selected_project': selected_project,
            'org_results': self.group_project_list(project_list),
            'dsn': dsn_private,
            'dsn_public': dsn_public,

        }
        return context

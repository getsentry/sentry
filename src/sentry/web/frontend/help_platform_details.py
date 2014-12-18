from __future__ import absolute_import

from django.db.models import Q
from django.http import Http404
from itertools import groupby

from sentry.constants import PLATFORM_LIST, PLATFORM_TITLES
from sentry.models import Project, ProjectKey
from sentry.web.helpers import render_to_response, render_to_string
from sentry.web.frontend.base import BaseView


class HelpPlatformDetailsView(BaseView):
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
            for team, team_project_list in groupby(org_project_list, key=lambda x: x.team):
                org_results.append((team, team_project_list))
            results.append((org, org_results))
        return results

    def get(self, request, platform):
        if platform not in PLATFORM_LIST:
            raise Http404

        template = 'sentry/partial/client_config/%s.html' % (platform,)

        if request.user.is_authenticated():
            project_list = self.get_project_list(request.user)
        else:
            project_list = []

        org_results = self.group_project_list(project_list)

        try:
            pid = int(request.GET.get('pid', request.session.get('pid', 0)))
        except (TypeError, ValueError):
            pid = None

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
            try:
                key = ProjectKey.objects.filter(user=None, project=project)[0]
            except ProjectKey.DoesNotExist:
                try:
                    key = ProjectKey.objects.get(user=request.user, project=project)
                except IndexError:
                    key = None
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
            'org_results': org_results,
            'dsn': dsn_private,
            'dsn_public': dsn_public,
            'platform': platform,
            'platform_title': PLATFORM_TITLES.get(platform, platform.title()),
        }

        context['template'] = render_to_string(template, context, request)

        return render_to_response('sentry/help/platform_details.html', context, request)

from __future__ import absolute_import

from sentry.models import TeamMemberType
from sentry.web.frontend.base import TeamView


class TeamProjectsView(TeamView):
    required_access = TeamMemberType.MEMBER

    def get(self, request, organization, team):
        project_list = team.project_set.all()
        project_list = sorted(project_list, key=lambda o: o.slug)
        for project in project_list:
            project.team = team

        context = {
            'project_list': project_list,
        }

        return self.respond('sentry/teams/projects/index.html', context)

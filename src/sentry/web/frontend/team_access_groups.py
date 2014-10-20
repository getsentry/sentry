from __future__ import absolute_import

from sentry.models import AccessGroup, TeamMemberType
from sentry.web.frontend.base import TeamView


class TeamAccessGroupsView(TeamView):
    required_access = TeamMemberType.MEMBER

    def get(self, request, organization, team):
        context = {
            'group_list': AccessGroup.objects.filter(team=team),
        }

        return self.respond('sentry/teams/groups/list.html', context)

from __future__ import absolute_import

from sentry.models import AccessGroup, OrganizationMemberType
from sentry.web.frontend.base import TeamView


class TeamAccessGroupsView(TeamView):
    required_access = OrganizationMemberType.MEMBER

    def get(self, request, organization, team):
        context = {
            'group_list': AccessGroup.objects.filter(team=team),
        }

        return self.respond('sentry/teams/groups/list.html', context)

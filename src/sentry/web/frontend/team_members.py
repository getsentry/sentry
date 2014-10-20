from __future__ import absolute_import

from sentry.models import TeamMemberType
from sentry.web.frontend.base import TeamView


class TeamMembersView(TeamView):
    required_access = TeamMemberType.MEMBER

    def get(self, request, organization, team):
        member_list = [
            (pm, pm.user)
            for pm in team.member_set.select_related('user').order_by('user__username')
        ]
        pending_member_list = [
            (pm, pm.email)
            for pm in team.pending_member_set.all().order_by('email')
        ]

        context = {
            'member_list': member_list,
            'pending_member_list': pending_member_list,
        }

        return self.respond('sentry/teams/members/index.html', context)

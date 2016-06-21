from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import OrganizationMember


class TeamMembersEndpoint(TeamEndpoint):
    def get(self, request, team):
        queryset = OrganizationMember.objects.filter(
            organization=team.organization,
            teams=team,
        ).select_related('user')

        member_list = sorted(
            queryset,
            key=lambda x: x.user.get_display_name() if x.user_id else x.email
        )

        context = serialize(member_list, request.user)

        return Response(context)

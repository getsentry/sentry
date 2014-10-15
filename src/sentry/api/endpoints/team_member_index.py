from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Team
from rest_framework.response import Response


class TeamMemberIndexEndpoint(Endpoint):
    def get(self, request, team_id):
        team = Team.objects.get_from_cache(id=team_id)

        assert_perm(team, request.user, request.auth)

        member_list = serialize(
            list(team.member_set.select_related('user')),
            request.user)
        member_list.extend(serialize(
            list(team.pending_member_set.all()),
            request.user))
        member_list.sort(key=lambda x: x['email'])

        return Response(member_list)

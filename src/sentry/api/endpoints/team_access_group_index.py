from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.team import TeamEndpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import AccessGroup


class TeamAccessGroupIndexEndpoint(TeamEndpoint):
    def get(self, request, team):
        assert_perm(team, request.user, request.auth)

        data = sorted(AccessGroup.objects.filter(team=team), key=lambda x: x.name)

        return Response(serialize(data, request.user))

from __future__ import absolute_import

from rest_framework.response import Response
from six.moves import range

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint
from sentry.api.permissions import assert_perm
from sentry.models import Team, Project


class TeamStatsEndpoint(BaseStatsEndpoint):
    def get(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user, request.auth)

        projects = Project.objects.get_for_user(
            team=team,
            user=request.user,
        )

        if not projects:
            return Response([])

        data = tsdb.get_range(
            model=tsdb.models.project,
            keys=[p.id for p in projects],
            **self._parse_args(request)
        ).values()

        summarized = []
        for n in range(len(data[0])):
            total = sum(d[n][1] for d in data)
            summarized.append((data[0][n][0], total))

        return Response(summarized)

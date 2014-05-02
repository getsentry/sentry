from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint
from sentry.api.permissions import assert_perm
from sentry.models import Team, Project


class TeamStatsEndpoint(BaseStatsEndpoint):
    def get(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user)

        days = min(int(request.GET.get('days', 1)), 30)

        projects = Project.objects.get_for_user(request.user, team=team)

        data = tsdb.get_range(
            model=tsdb.models.project,
            keys=[p.id for p in projects],
            **self._parse_args(request)
        )

        return Response(data)

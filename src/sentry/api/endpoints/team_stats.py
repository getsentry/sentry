from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Team, Project


class TeamStatsEndpoint(Endpoint):
    def get(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user)

        projects = Project.objects.get_for_user(request.user, team=team)

        data = Project.objects.get_chart_data_for_group(
            instances=projects,
            max_days=min(int(request.GET.get('days', 1)), 30),
        )

        return Response(data)

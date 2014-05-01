from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Team, Project
from sentry.tsdb.base import TSDBModel


class TeamStatsEndpoint(Endpoint):
    def get(self, request, team_id):
        team = Team.objects.get(id=team_id)

        assert_perm(team, request.user)

        days = min(int(request.GET.get('days', 1)), 30)

        projects = Project.objects.get_for_user(request.user, team=team)

        end = timezone.now()
        start = end - timedelta(days=days)

        data = tsdb.get_range(TSDBModel.project, [p.id for p in projects], start, end)

        return Response(data)

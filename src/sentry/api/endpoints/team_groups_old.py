from datetime import datetime, timedelta

from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import GroupSerializer, serialize
from sentry.models import Group, GroupStatus


class TeamGroupsOldEndpoint(TeamEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request: Request, team) -> Response:
        """
        Return the oldest issues owned by a team
        """
        limit = min(100, int(request.GET.get("limit", 10)))
        environments = [e.id for e in get_environments(request, team.organization)]
        group_environment_filter = (
            Q(groupenvironment__environment_id=environments[0]) if environments else Q()
        )

        group_list = list(
            Group.objects.filter_to_team(team)
            .filter(
                group_environment_filter,
                status=GroupStatus.UNRESOLVED,
                last_seen__gt=datetime.now() - timedelta(days=90),
            )
            .order_by("first_seen")[:limit]
        )

        return Response(
            serialize(
                group_list,
                request.user,
                GroupSerializer(
                    environment_func=self._get_environment_func(request, team.organization_id)
                ),
            )
        )

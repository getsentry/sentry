from datetime import datetime, timedelta

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import GroupSerializer, serialize
from sentry.models import Group, GroupStatus


class TeamGroupsOldEndpoint(TeamEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request: Request, team) -> Response:
        """
        Return the oldest issues owned by a team
        """
        limit = min(100, int(request.GET.get("limit", 10)))
        group_list = list(
            Group.objects.filter_to_team(team)
            .filter(
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

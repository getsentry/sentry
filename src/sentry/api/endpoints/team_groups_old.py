from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import GroupSerializer, serialize
from sentry.models import Group, GroupStatus, Project


class TeamGroupsOldEndpoint(TeamEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request, team) -> Response:
        """
        Return the oldest issues in a team's projects
        """
        project_list = Project.objects.get_for_team_ids([team.id])
        limit = min(100, int(request.GET.get("limit", 10)))

        group_list = list(
            Group.objects.filter(
                status=GroupStatus.UNRESOLVED,
                project__in=project_list,
            )
            .extra(select={"sort_by": "sentry_groupedmessage.first_seen"})
            .select_related("project")
            .order_by("sort_by")[:limit]
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

from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.models import GroupHistory, GroupHistoryStatus, Project


class TeamTimeToResolutionEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Return a a time bucketed list of mean group resolution times for a given team.
        """

        project_list = Project.objects.get_for_team_ids(team_ids=[team])

        history_list = list(
            GroupHistory.objects.filter(
                status=GroupHistoryStatus.UNRESOLVED.value,
                project__in=project_list,
            )
        )

        return Response(history_list)

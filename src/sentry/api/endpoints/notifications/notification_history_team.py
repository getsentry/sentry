from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.bases.team import TeamEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.models.notificationhistory import NotificationHistory
from sentry.models.team import Team


class NotificationHistoryTeamEndpoint(TeamEndpoint):
    owner = ApiOwner.ECOSYSTEM

    def get(self, request: Request, team: Team) -> Response:
        queryset = NotificationHistory.objects.filter(team=team).order_by("-date_added")
        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda action: serialize(action, request.user),
            paginator_cls=OffsetPaginator,
        )

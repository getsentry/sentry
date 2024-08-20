from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.interfaces.user import User
from sentry.models.notificationhistory import NotificationHistory


class NotificationHistoryUserEndpoint(UserEndpoint):
    owner = ApiOwner.ECOSYSTEM

    def get(self, request: Request, user: User) -> Response:
        queryset = NotificationHistory.objects.filter(user_id=user.id)
        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda action: serialize(action, request.user),
            paginator_cls=OffsetPaginator,
        )

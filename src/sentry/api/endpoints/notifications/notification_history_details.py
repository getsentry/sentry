from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.rest_framework.notification_history import NotificationHistorySerializer
from sentry.models.notificationhistory import NotificationHistory


class NotificationHistoryDetailsEndpoint(Endpoint):
    owner = ApiOwner.ECOSYSTEM
    permission_classes = ()

    def convert_args(
        self, request: Request, notification_history_id: int | str | None = None, *args, **kwargs
    ):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            history = NotificationHistory.objects.get(id=notification_history_id)
        except NotificationHistory.DoesNotExist:
            raise Http404

        if history.user_id is not None and request.user.id != history.user_id:
            raise PermissionDenied
        if history.team is not None and request.user.id not in history.team.member_set:
            raise PermissionDenied

        kwargs["notification_history"] = history
        return args, kwargs

    def put(self, request: Request, notification_history: NotificationHistory) -> Response:
        serializer = NotificationHistorySerializer(
            instance=notification_history,
            context={
                "access": request.access,
                "user": request.user,
            },
            data=request.data,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.save()
        return Response(serialize(action, user=request.user), status=status.HTTP_202_ACCEPTED)

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.models import User
from sentry.models.notificationsettingoption import NotificationSettingOption


@control_silo_endpoint
class UserNotificationSettingsOptionsDetailEndpoint(UserEndpoint):
    # TODO(Steve): Make not private when we launch new system
    private = True

    def delete(self, request: Request, user: User, notification_option_id: str) -> Response:
        try:
            option = NotificationSettingOption.objects.get(
                id=notification_option_id,
            )
        except NotificationSettingOption.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        option.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

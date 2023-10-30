from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.user import User


@control_silo_endpoint
class UserNotificationSettingsOptionsDetailEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES
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

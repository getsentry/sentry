from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.utils import to_valid_int_id
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.models.user import User


@control_silo_endpoint
class UserNotificationSettingsOptionsDetailEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.NOTIFICATIONS

    def convert_args(
        self,
        request: Request,
        user_id: int | str | None = None,
        *args,
        notification_option_id: int,
        **kwargs,
    ) -> tuple[tuple[object, ...], dict[str, object]]:
        args, kwargs = super().convert_args(request, user_id, *args, **kwargs)
        user = kwargs["user"]
        try:
            option = NotificationSettingOption.objects.get(
                id=to_valid_int_id(
                    "notification_option_id", notification_option_id, raise_404=True
                ),
                user=user,
            )
        except NotificationSettingOption.DoesNotExist:
            raise NotFound(detail="User notification setting does not exist")

        kwargs["notification_setting_option"] = option
        return args, kwargs

    def delete(
        self, request: Request, user: User, notification_setting_option: NotificationSettingOption
    ) -> Response:
        notification_setting_option.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.notification_setting import NotificationSettingsSerializer
from sentry.api.validators.notifications import validate, validate_type_option
from sentry.models import NotificationSetting, User


class UserNotificationSettingsDetailsEndpoint(UserEndpoint):
    """
    This Notification Settings endpoint is the generic way to interact with the
    NotificationSettings table via the API.
    TODO(mgaeta): If this is going to replace the UserNotificationDetailsEndpoint
     and UserNotificationFineTuningEndpoint endpoints, then it should probably
     be able to translate legacy values from UserOptions.
    """

    def get(self, request: Request, user: User) -> Response:
        """
        Get the Notification Settings for a given User.
        ````````````````````````````````
        :pparam string user_id: A User's `user_id` or "me" for current user.
        :qparam string type: If set, filter the NotificationSettings to this type.

        :auth required:
        """

        type_option = validate_type_option(request.GET.get("type"))

        return Response(
            serialize(
                user,
                request.user,
                NotificationSettingsSerializer(),
                type=type_option,
            ),
        )

    def put(self, request: Request, user: User) -> Response:
        """
        Update the Notification Settings for a given User.
        ````````````````````````````````
        :pparam string user_id: A User's `user_id` or "me" for current user.
        :param map <anonymous>: The POST data for this request should be several
            nested JSON mappings. The bottommost value is the "value" of the
            notification setting and the order of scoping is:
              - type (str),
              - scope_type (str),
              - scope_identifier (int or str)
              - provider (str)
            Example: {
                "workflow": {
                    "user": {
                        "me": {
                            "email": "never",
                            "slack": "never"
                        },
                    },
                    "project": {
                        1: {
                            "email": "always",
                            "slack": "always"
                        },
                        2: {
                            "email": "subscribe_only",
                            "slack": "subscribe_only"
                        }
                    }
                }
            }

        :auth required:
        """

        notification_settings = validate(request.data, user=user)
        NotificationSetting.objects.update_settings_bulk(notification_settings, user=user)

        return Response(status=status.HTTP_204_NO_CONTENT)

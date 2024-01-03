from collections import defaultdict

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.models.options.user_option import UserOption
from sentry.notifications.types import UserOptionsSettingsKey

USER_OPTION_SETTINGS = {
    UserOptionsSettingsKey.SELF_ACTIVITY: {
        "key": "self_notifications",
        "default": "0",
    },
    UserOptionsSettingsKey.SELF_ASSIGN: {
        "key": "self_assign_issue",
        "default": "0",
    },
}


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):
        user_options = UserOption.objects.filter(
            user__in=item_list, organization_id=None, project_id=None
        ).select_related("user")
        keys_to_user_option_objects = {user_option.key: user_option for user_option in user_options}

        results = defaultdict(list)
        for user_option in keys_to_user_option_objects.values():
            results[user_option.user].append(user_option)
        return results

    def serialize(self, obj, attrs, user, *args, **kwargs):
        raw_data = {option.key: option.value for option in attrs}

        data = {}
        for key, uo in USER_OPTION_SETTINGS.items():
            val = raw_data.get(uo["key"], uo["default"])
            data[key.value] = bool(int(val))  # '1' is true, '0' is false

        return data


# only expose legacy options
class UserNotificationDetailsSerializer(serializers.Serializer):
    personalActivityNotifications = serializers.BooleanField(required=False)
    selfAssignOnResolve = serializers.BooleanField(required=False)


@control_silo_endpoint
class UserNotificationDetailsEndpoint(UserEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, user) -> Response:
        serialized = serialize(user, request.user, UserNotificationsSerializer())
        return Response(serialized)

    def put(self, request: Request, user) -> Response:
        serializer = UserNotificationDetailsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        for key, value in serializer.validated_data.items():
            try:
                key = UserOptionsSettingsKey(key)
            except ValueError:
                return Response(
                    {"detail": "Unknown key: %s." % key},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user_option, _ = UserOption.objects.get_or_create(
                key=USER_OPTION_SETTINGS[key]["key"],
                user=user,
                project_id=None,
                organization_id=None,
            )
            user_option.update(value=str(int(value)))

        return self.get(request, user)

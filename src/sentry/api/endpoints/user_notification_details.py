from collections import defaultdict
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize, Serializer
from sentry.models import UserOption
from sentry.models.integration import ExternalProviders
from sentry.models.notificationsetting import NotificationSetting
from sentry.notifications.legacy_mappings import (
    get_option_value_from_int,
    get_type_from_user_option_settings_key,
    USER_OPTION_SETTINGS,
)
from sentry.notifications.types import UserOptionsSettingsKey


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):
        data = list(
            UserOption.objects.filter(
                user__in=item_list, organization=None, project=None
            ).select_related("user")
        )

        results = defaultdict(list)

        for uo in data:
            results[uo.user].append(uo)

        return results

    def serialize(self, obj, attrs, user, *args, **kwargs):
        raw_data = {option.key: option.value for option in attrs}

        data = {}
        for key, uo in USER_OPTION_SETTINGS.items():
            val = raw_data.get(uo["key"], uo["default"])
            if uo["type"] == bool:
                data[key.value] = bool(int(val))  # '1' is true, '0' is false
            elif uo["type"] == int:
                data[key.value] = int(val)

        data["weeklyReports"] = True  # This cannot be overridden

        return data


class UserNotificationDetailsSerializer(serializers.Serializer):
    deployNotifications = EmptyIntegerField(
        required=False, min_value=2, max_value=4, allow_null=True
    )
    personalActivityNotifications = serializers.BooleanField(required=False)
    selfAssignOnResolve = serializers.BooleanField(required=False)
    subscribeByDefault = serializers.BooleanField(required=False)
    workflowNotifications = EmptyIntegerField(
        required=False, min_value=0, max_value=2, allow_null=True
    )


class UserNotificationDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        serialized = serialize(user, request.user, UserNotificationsSerializer())
        return Response(serialized)

    def put(self, request, user):
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

            type = get_type_from_user_option_settings_key(key)
            if type:
                NotificationSetting.objects.update_settings(
                    ExternalProviders.EMAIL,
                    type,
                    get_option_value_from_int(type, int(value)),
                    user=user,
                )
            else:
                user_option, _ = UserOption.objects.get_or_create(
                    key=USER_OPTION_SETTINGS[key]["key"],
                    user=user,
                    project=None,
                    organization=None,
                )
                user_option.update(value=str(int(value)))

        return self.get(request, user)

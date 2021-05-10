from collections import defaultdict

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import Serializer, serialize
from sentry.models import NotificationSetting, UserOption
from sentry.notifications.types import NotificationScopeType, UserOptionsSettingsKey
from sentry.notifications.utils.legacy_mappings import (
    USER_OPTION_SETTINGS,
    get_option_value_from_int,
    get_type_from_user_option_settings_key,
    map_notification_settings_to_legacy,
)
from sentry.types.integrations import ExternalProviders


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):
        user_options = UserOption.objects.filter(
            user__in=item_list, organization=None, project=None
        ).select_related("user")
        keys_to_user_option_objects = {user_option.key: user_option for user_option in user_options}

        actor_mapping = {user.actor_id: user for user in item_list}
        notification_settings = NotificationSetting.objects._filter(
            ExternalProviders.EMAIL,
            scope_type=NotificationScopeType.USER,
            target_ids=actor_mapping.keys(),
        )
        notification_settings_as_user_options = map_notification_settings_to_legacy(
            notification_settings, actor_mapping
        )

        # Override deprecated UserOption rows with NotificationSettings.
        for user_option in notification_settings_as_user_options:
            keys_to_user_option_objects[user_option.key] = user_option

        results = defaultdict(list)
        for user_option in keys_to_user_option_objects.values():
            results[user_option.user].append(user_option)
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

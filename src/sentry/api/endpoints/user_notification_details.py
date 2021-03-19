from collections import defaultdict
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize, Serializer
from sentry.models import UserOption
from sentry.notifications.legacy_mappings import USER_OPTION_SETTINGS
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

        if serializer.is_valid():
            for key, value in serializer.validated_data.items():
                db_key = USER_OPTION_SETTINGS[UserOptionsSettingsKey(key)]["key"]
                (uo, created) = UserOption.objects.get_or_create(
                    user=user, key=db_key, project=None, organization=None
                )
                # Convert integers and booleans to string representations of ints.
                uo.update(value=str(int(value)))

            return self.get(request, user)
        else:
            return Response(serializer.errors, status=400)

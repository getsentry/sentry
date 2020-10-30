from __future__ import absolute_import

import six

from collections import defaultdict

from sentry.api.bases.user import UserEndpoint
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers import serialize, Serializer
from sentry.models import UserOption, UserOptionValue


from rest_framework.response import Response

from rest_framework import serializers

USER_OPTION_SETTINGS = {
    "deployNotifications": {
        "key": "deploy-emails",
        "default": UserOptionValue.committed_deploys_only,  # '3'
        "type": int,
    },
    "personalActivityNotifications": {
        "key": "self_notifications",
        "default": UserOptionValue.all_conversations,  # '0'
        "type": bool,
    },
    "selfAssignOnResolve": {
        "key": "self_assign_issue",
        "default": UserOptionValue.all_conversations,  # '0'
        "type": bool,
    },
    "subscribeByDefault": {
        "key": "subscribe_by_default",
        "default": UserOptionValue.participating_only,  # '1'
        "type": bool,
    },
    "workflowNotifications": {
        "key": "workflow:notifications",
        "default": UserOptionValue.participating_only,  # '1'
        "type": int,
    },
}


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
        for key in USER_OPTION_SETTINGS:
            uo = USER_OPTION_SETTINGS[key]
            val = raw_data.get(uo["key"], uo["default"])
            if uo["type"] == bool:
                data[key] = bool(int(val))  # '1' is true, '0' is false
            elif uo["type"] == int:
                data[key] = int(val)

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
            for key in serializer.validated_data:
                db_key = USER_OPTION_SETTINGS[key]["key"]
                val = six.text_type(int(serializer.validated_data[key]))
                (uo, created) = UserOption.objects.get_or_create(
                    user=user, key=db_key, project=None, organization=None
                )
                uo.update(value=val)

            return self.get(request, user)
        else:
            return Response(serializer.errors, status=400)

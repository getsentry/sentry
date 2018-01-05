from __future__ import absolute_import

import six

from collections import defaultdict

from sentry.api.bases.user import UserEndpoint
from sentry.models import UserOption, UserOptionValue, Project

from sentry.api.serializers import serialize, Serializer

from rest_framework.response import Response

from rest_framework import serializers

USER_OPTION_SETTINGS = {
    'deployNotifications': {
        'key': 'deploy-emails',
        'default': UserOptionValue.committed_deploys_only,  # '3'
        'type': int,
    },
    'personalActivityNotifications': {
        'key': 'self_notifications',
        'default': UserOptionValue.all_conversations,  # '0'
        'type': bool,
    },
    'selfAssignOnResolve': {
        'key': 'self_assign_issue',
        'default': UserOptionValue.all_conversations,  # '0'
        'type': bool,
    },
    'subscribeByDefault': {
        'key': 'subscribe_by_default',
        'default': UserOptionValue.participating_only,  # '1'
        'type': bool,
    },
    'workflowNotifications': {
        'key': 'workflow:notifications',
        'default': UserOptionValue.all_conversations,  # '0'
        'type': int,
    }
}

KEY_MAP = {v['key']: k for k, v in six.iteritems(USER_OPTION_SETTINGS)}

DISABLED_REPORTS_KEY = 'reports:disabled-organizations'


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):

        all_keys = [key for key in KEY_MAP] + [DISABLED_REPORTS_KEY]

        data = list(UserOption.objects.filter(
            key__in=all_keys,
            user__in=item_list
        ).select_related('user', 'project'))

        results = defaultdict(list)

        for uo in data:
            results[uo.user].append(uo)

        return results

    def convert_type(self, val, external_type):
        if (external_type == bool):
            return bool(int(val))  # '1' is true, '0' is false
        elif (external_type == int):
            return int(val)
        else:
            return val

    def serialize(self, obj, attrs, user, *args, **kwargs):

        data = defaultdict(lambda: {})

        # Set all the defaults first
        for key in USER_OPTION_SETTINGS:
            setting = USER_OPTION_SETTINGS[key]
            data[key]['default'] = self.convert_type(setting['default'], setting['type'])
            data[key]['projects'] = {}

        data['weeklyReports']['default'] = True  # This cannot be overridden

        # Then go through the retreived options
        for option in attrs:
            if option.key == DISABLED_REPORTS_KEY:
                slugs = [
                    project.slug for project in Project.objects.filter(
                        id__in=option.value or [])]

                data['weeklyReports']['projects'] = dict.fromkeys(slugs, True)

            else:
                key = KEY_MAP[option.key]
                external_type = USER_OPTION_SETTINGS[key]['type']

                if option.project:
                    data[key]['projects'][option.project.slug] = self.convert_type(
                        option.value, external_type)
                else:
                    data[key]['default'] = self.convert_type(option.value, external_type)

        return data


class UserNotificationDetailsSerializer(serializers.Serializer):
    deployNotifications = serializers.IntegerField(required=False, min_value=2, max_value=4)
    personalActivityNotifications = serializers.BooleanField(required=False)
    selfAssignOnResolve = serializers.BooleanField(required=False)
    subscribeByDefault = serializers.BooleanField(required=False)
    workflowNotifications = serializers.IntegerField(required=False, min_value=0, max_value=2)


class UserNotificationDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        serialized = serialize(user, request.user, UserNotificationsSerializer())
        return Response(serialized)

    def put(self, request, user):
        serializer = UserNotificationDetailsSerializer(data=request.DATA)

        if serializer.is_valid():
            for key in serializer.object:
                db_key = USER_OPTION_SETTINGS[key]['key']
                val = six.text_type(int(serializer.object[key]))
                (uo, created) = UserOption.objects.get_or_create(
                    user=user, key=db_key, project=None)
                uo.update(value=val)

            return self.get(request, user)
        else:
            return Response(serializer.errors, status=400)

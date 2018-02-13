from __future__ import absolute_import

import six
from collections import defaultdict

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize, Serializer
from sentry.models import Organization, Project, UserOption


KEY_MAP = {
    'alerts': {
        'key': 'mail:alert',
        'type': bool,
    },

    'workflow': {
        'key': 'workflow:notifications',
        'type': int,
    },

    'deploy': {
        'key': 'deploy-emails',
        'type': int,
    },

    'reports': {
        'key': 'reports:disabled-organizations',
    },
}


class UserNotificationsSerializer(Serializer):
    def convert_type(self, val, external_type):
        if (external_type == bool):
            return int(val)  # '1' is true, '0' is false
        elif (external_type == int):
            return int(val)
        else:
            return val

    def get_attrs(self, item_list, user, *args, **kwargs):
        notification_type = kwargs['notification_type']
        filter_args = {}

        if notification_type in ['alerts', 'workflow']:
            filter_args['project__isnull'] = False
        elif notification_type == 'deploy':
            filter_args['organization__isnull'] = False

        data = list(UserOption.objects.filter(
            key=KEY_MAP[notification_type]['key'],
            user__in=item_list,
            **filter_args
        ).select_related('user', 'project', 'organization'))

        results = defaultdict(list)

        for uo in data:
            results[uo.user].append(uo)

        return results

    def serialize(self, obj, attrs, user, *args, **kwargs):
        notification_type = kwargs['notification_type']
        data = {}

        for uo in attrs:
            if uo.project is not None:
                data[uo.project.id] = uo.value
            elif uo.organization is not None:
                data[uo.organization.id] = uo.value
            elif notification_type == 'reports':
                # UserOption for key=reports:disabled-organizations saves a list of orgIds
                # that should be disabled
                for org_id in uo.value:
                    data[org_id] = 0
        return data


class UserNotificationFineTuningEndpoint(UserEndpoint):
    def get(self, request, user, notification_type):
        if notification_type not in KEY_MAP:
            return Response(status=status.HTTP_404_NOT_FOUND)

        notifications = UserNotificationsSerializer()

        serialized = serialize(
            user,
            request.user,
            notifications,
            notification_type=notification_type
        )
        return Response(serialized)

    def put(self, request, user, notification_type):
        if notification_type not in KEY_MAP:
            return Response(status=status.HTTP_404_NOT_FOUND)

        key = KEY_MAP[notification_type]
        filter_args = {
            'user': user,
            'key': key['key'],
        }

        if notification_type == 'reports':
            (user_option, created) = UserOption.objects.get_or_create(**filter_args)

            value = user_option.value or []
            for org_id, enabled in request.DATA.items():
                # TODO(billy) Check existence + user permission to org
                if enabled:
                    value.remove(int(org_id))
                else:
                    value.insert(0, int(org_id))

            user_option.update(value=value)
            return Response(status=status.HTTP_204_NO_CONTENT)

        if notification_type in ['alerts', 'workflow']:
            update_key = 'project'
            parent = Project
        else:
            update_key = 'organization'
            parent = Organization

        with transaction.atomic():
            for slug in request.DATA:
                val = int(request.DATA[slug])

                try:
                    # TODO(billy) Check user permission to org/project
                    model = parent.objects.get(id=slug)
                except parent.DoesNotExist:
                    return Response(status=status.HTTP_404_NOT_FOUND)

                filter_args[update_key] = model

                # -1 is a magic value to use "default" value, so just delete option
                if val == -1:
                    try:
                        UserOption.objects.get(**filter_args).delete()
                    except UserOption.DoesNotExist:
                        return Response(stauts=status.HTTP_404_NOT_FOUND)
                else:
                    (user_option, _) = UserOption.objects.get_or_create(**filter_args)

                    # Values have been saved as strings for `mail:alerts` *shrug*
                    # `reports:disabled-organizations` requires an array of its
                    user_option.update(value=six.text_type(val) if key['type'] is int else val)

            return Response(status=status.HTTP_204_NO_CONTENT)

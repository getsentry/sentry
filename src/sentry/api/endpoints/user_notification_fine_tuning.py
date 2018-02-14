from __future__ import absolute_import

import six
from collections import defaultdict

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize, Serializer
from sentry.models import Organization, OrganizationMember, OrganizationMemberTeam, OrganizationStatus, Project, ProjectTeam, UserOption


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
                # that should not receive reports
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

            # set of org ids that user is a member of
            org_ids = self.get_org_ids(user)

            for org_id, enabled in request.DATA.items():
                org_id = int(org_id)

                # make sure user is in org
                if org_id not in org_ids:
                    return Response(status=status.HTTP_403_FORBIDDEN)

                if enabled:
                    value.remove(org_id)
                else:
                    value.insert(0, org_id)

            user_option.update(value=value)
            return Response(status=status.HTTP_204_NO_CONTENT)

        if notification_type in ['alerts', 'workflow']:
            update_key = 'project'
            parent = Project
            parent_ids = self.get_project_ids(user)
        else:
            update_key = 'organization'
            parent = Organization
            parent_ids = self.get_org_ids(user)

        with transaction.atomic():
            for id in request.DATA:
                val = int(request.DATA[id])

                # check for org or project membership
                if int(id) not in parent_ids:
                    return Response(status=status.HTTP_403_FORBIDDEN)

                try:
                    model = parent.objects.get(id=id)
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

    def get_org_ids(self, user):
        """ Get org ids for user """
        return set(
            OrganizationMember.objects.filter(
                user=user,
                organization__status=OrganizationStatus.ACTIVE
            ).values_list('organization_id', flat=True)
        )

    def get_project_ids(self, user):
        """ Get project ids that user has access to """
        return set(
            ProjectTeam.objects.filter(
                team_id__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=user
                ).values_list('team_id', flat=True)
            ).values_list('project_id', flat=True))

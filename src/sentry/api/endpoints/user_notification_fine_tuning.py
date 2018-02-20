from __future__ import absolute_import

import six
from collections import defaultdict

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize, Serializer
from sentry.models import OrganizationMember, OrganizationMemberTeam, OrganizationStatus, ProjectTeam, UserOption, UserEmail


KEY_MAP = {
    'alerts': {
        'key': 'mail:alert',
        'type': int,
    },

    'workflow': {
        'key': 'workflow:notifications',
        'type': '',
    },

    'deploy': {
        'key': 'deploy-emails',
        'type': '',
    },

    'reports': {
        'key': 'reports:disabled-organizations',
        'type': '',
    },

    'email': {
        'key': 'mail:email',
        'type': '',
    }
}


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):
        notification_type = kwargs['notification_type']
        filter_args = {}

        if notification_type in ['alerts', 'workflow', 'email']:
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
                # We want "0" to be falsey
                enabled = int(enabled)

                # make sure user is in org
                if org_id not in org_ids:
                    return Response(status=status.HTTP_403_FORBIDDEN)

                if enabled:
                    value.remove(org_id)
                else:
                    value.insert(0, org_id)

            user_option.update(value=value)
            return Response(status=status.HTTP_204_NO_CONTENT)

        if notification_type in ['alerts', 'workflow', 'email']:
            update_key = 'project'
            parent_ids = set(self.get_project_ids(user))
        else:
            update_key = 'organization'
            parent_ids = set(self.get_org_ids(user))

        ids_to_update = set([int(i) for i in request.DATA.keys()])

        # make sure that the ids we are going to update are a subset of the user's
        # list of orgs or projects
        if not ids_to_update.issubset(parent_ids):
            return Response(status=status.HTTP_403_FORBIDDEN)

        if notification_type == 'email':
            # make sure target emails exist and are verified
            emails_to_check = set(request.DATA.values())
            emails = UserEmail.objects.filter(
                user=user,
                email__in=emails_to_check,
                is_verified=True
            )

            # Is there a better way to check this?
            if len(emails) != len(emails_to_check):
                return Response(status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for id in request.DATA:
                val = request.DATA[id]
                int_val = int(val) if notification_type != 'email' else None

                filter_args['%s_id' % update_key] = id

                # 'email' doesn't have a default to delete, and it's a string
                # -1 is a magic value to use "default" value, so just delete option
                if int_val == -1:
                    try:
                        UserOption.objects.get(**filter_args).delete()
                    except UserOption.DoesNotExist:
                        # This state is actually what we want
                        pass
                else:
                    (user_option, _) = UserOption.objects.get_or_create(**filter_args)

                    # Values have been saved as strings for `mail:alerts` *shrug*
                    # `reports:disabled-organizations` requires an array of ids
                    user_option.update(value=int_val if key['type'] is int else six.text_type(val))

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

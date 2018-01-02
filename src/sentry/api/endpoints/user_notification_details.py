from __future__ import absolute_import

from collections import defaultdict

from sentry.api.bases.user import UserEndpoint
from sentry.models import UserOption, UserOptionValue

from sentry.api.serializers import serialize, Serializer

from rest_framework.response import Response

USER_OPTION_DEFAULTS = {
    'deploy-emails': UserOptionValue.committed_deploys_only,  # '3'
    'self_notifications': UserOptionValue.all_conversations,  # '0'
    'self_assign_issue': UserOptionValue.all_conversations,  # '0'
    'subscribe_by_default': UserOptionValue.participating_only,  # '1'
    'workflow:notifications': UserOptionValue.all_conversations,  # '0
}


class UserNotificationsSerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):
        data = list(UserOption.objects.filter(
            user__in=item_list,
            project=None).select_related('user'))

        results = defaultdict(list)

        for uo in data:
            results[uo.user].append(uo)

        return results

    def serialize(self, obj, attrs, user, *args, **kwargs):

        raw_data = {option.key: option.value for option in attrs}

        data = {}
        for key in USER_OPTION_DEFAULTS:
            data[key] = raw_data.get(key, USER_OPTION_DEFAULTS[key])

        # for the boolean values, '1' is true, '0' is false
        return {
            'deployNotifications': int(data.get('deploy-emails')),
            'personalActivityNotifications': bool(int(data.get('self_notifications'))),
            'selfAssignOnResolve': bool(int(data.get('self_assign_issue'))),
            'subscribeByDefault': bool(int(data.get('subscribe_by_default'))),
            'workflowNotifications': int(data.get('workflow:notifications'))
        }


class UserNotificationDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        serialized = serialize(user, request.user, UserNotificationsSerializer())
        return Response(serialized)

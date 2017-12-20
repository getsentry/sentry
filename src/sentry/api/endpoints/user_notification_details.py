from __future__ import absolute_import

from collections import defaultdict

from sentry.api.bases.user import UserEndpoint
from sentry.models import UserOption

from sentry.api.serializers import serialize, Serializer

from rest_framework.response import Response


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
        data = {option.key: option.value for option in attrs}

        return {
            'alertEmail': data.get('alert_email'),
            'deployEmails': data.get('deploy-emails'),
            'seenReleaseBroadcast': data.get('seen_release_broadcast'),
            'selfAssignIssue': data.get('self_assign_issue'),
            'selfNotifications': data.get('self_notifications'),
            'subscribeByDefault': data.get('subscribe_by_default'),
            'workflowNotifications': data.get('workflow:notifications'),
        }


class UserNotificationDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        serialized = serialize(user, request.user, UserNotificationsSerializer())
        return Response(serialized)

from rest_framework.response import Response

from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import GroupSubscriptionManager


class GroupParticipantsEndpoint(GroupEndpoint):
    def get(self, request, group):
        participants = GroupSubscriptionManager.get_participating_users(group)

        return Response(serialize(participants, request.user))

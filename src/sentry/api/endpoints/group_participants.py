from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import GroupSubscriptionManager


@region_silo_endpoint
class GroupParticipantsEndpoint(GroupEndpoint):
    def get(self, request: Request, group) -> Response:
        participants = GroupSubscriptionManager.get_participating_users(group)

        return Response(serialize(participants, request.user))

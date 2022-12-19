from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.models import GroupSubscriptionManager
from sentry.services.hybrid_cloud.user import user_service


@region_silo_endpoint
class GroupParticipantsEndpoint(GroupEndpoint):
    def get(self, request: Request, group) -> Response:
        participants = GroupSubscriptionManager.get_participating_user_ids(group)
        return user_service.serialize_users(participants, as_user=request.user)

from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import User


class GroupParticipantsEndpoint(GroupEndpoint):
    def get(self, request, group):
        participants = list(User.objects.filter(
            groupsubscription__is_active=True,
            groupsubscription__group=group,
        ))

        return Response(serialize(participants, request.user))

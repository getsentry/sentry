from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import PendingTeamMember


@register(PendingTeamMember)
class PendingTeamMemberSerializer(Serializer):
    def serialize(self, obj, user):
        d = {
            'id': str(obj.id),
            'email': obj.email,
            'access': obj.get_type_display(),
            'pending': True,
            'dateCreated': obj.date_added,
        }
        return d

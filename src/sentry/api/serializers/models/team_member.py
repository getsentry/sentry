from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import TeamMember


@register(TeamMember)
class TeamMemberSerializer(Serializer):
    def serialize(self, obj, user):
        d = {
            'id': str(obj.id),
            'email': obj.user.email,
            'access': obj.get_type_display(),
            'pending': False,
            'dateCreated': obj.date_added,
        }
        return d

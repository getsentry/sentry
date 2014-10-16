from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import TeamMember
from sentry.utils.avatar import get_gravatar_url


@register(TeamMember)
class TeamMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'email': obj.user.email,
            'access': obj.get_type_display(),
            'pending': False,
            'dateCreated': obj.date_added,
            'avatarUrl': get_gravatar_url(obj.user.email, size=32),
        }
        return d

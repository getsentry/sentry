from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import EventUser
from sentry.utils.avatar import get_gravatar_url


@register(EventUser)
class EventUserSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'identifier': obj.ident,
            'username': obj.username,
            'email': obj.email,
            'ipAddress': obj.ip_address,
            'avatarUrl': get_gravatar_url(obj.email, size=32),
        }

from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import User
from sentry.utils.avatar import get_gravatar_url


@register(User)
class UserSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'name': obj.get_full_name(),
            'email': obj.email,
            'avatarUrl': get_gravatar_url(obj.email, size=32),
        }
        return d

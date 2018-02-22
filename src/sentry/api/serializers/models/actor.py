from __future__ import absolute_import

import six
from sentry.api.serializers import Serializer
from sentry.models import User, Team


class ActorSerializer(Serializer):
    def serialize(self, obj, attrs, *args, **kwargs):

        if isinstance(obj, User):
            actor_type = 'user'
            avatar = obj.avatar.first()
        elif isinstance(obj, Team):
            actor_type = 'team'
            avatar = ''
        else:
            raise AssertionError('Invalid type to assign to: %r' % type(obj))

        return {
            'type': actor_type,
            'id': six.text_type(obj.id),
            'name': obj.get_display_name(),
            'avatar': avatar,
        }

from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import OrganizationMember
from sentry.utils.avatar import get_gravatar_url


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'email': obj.email or obj.user.email,
            'access': obj.get_type_display(),
            'pending': obj.is_pending,
            'dateCreated': obj.date_added,
            'avatarUrl': get_gravatar_url(obj.email, size=32),
        }
        return d

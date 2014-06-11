from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import OrganizationMember


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'email': obj.email or obj.user.email,
            'access': obj.get_type_display(),
            'pending': obj.is_pending,
            'dateCreated': obj.date_added,
        }
        return d

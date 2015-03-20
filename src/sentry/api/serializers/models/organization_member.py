from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import OrganizationMember


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'email': obj.get_email(),
            'roleName': obj.get_type_display(),
            'pending': obj.is_pending,
            'flags': {
                'sso:linked': bool(getattr(obj.flags, 'sso:linked')),
                'sso:invalid': bool(getattr(obj.flags, 'sso:invalid')),
            },
            'dateCreated': obj.date_added,
        }
        return d

from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import OrganizationMember


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        if obj.user:
            user_data = {'id': obj.user.id}
        else:
            user_data = None

        d = {
            'id': str(obj.id),
            'email': obj.get_email(),
            'name': obj.user.get_display_name() if obj.user else obj.get_email(),
            'user': user_data,
            'role': obj.role,
            'roleName': obj.get_role_display(),
            'pending': obj.is_pending,
            'flags': {
                'sso:linked': bool(getattr(obj.flags, 'sso:linked')),
                'sso:invalid': bool(getattr(obj.flags, 'sso:invalid')),
            },
            'dateCreated': obj.date_added,
        }
        return d

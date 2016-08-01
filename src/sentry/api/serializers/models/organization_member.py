from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import OrganizationMember


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer): assert on relations
        users = {
            d['id']: d
            for d in serialize(set(i.user for i in item_list if i.user_id), user)
        }

        return {
            item: {
                'user': users[six.text_type(item.user_id)] if item.user_id else None,
            } for item in item_list
        }

    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'email': obj.get_email(),
            'name': obj.user.get_display_name() if obj.user else obj.get_email(),
            'user': attrs['user'],
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

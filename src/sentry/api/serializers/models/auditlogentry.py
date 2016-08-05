from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import AuditLogEntry


@register(AuditLogEntry)
class AuditLogEntrySerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        actors = {
            d['id']: d
            for d in serialize(set(i.actor for i in item_list if i.actor_id), user)
        }

        return {
            item: {
                'actor': actors[six.text_type(item.actor_id)] if item.actor_id else {
                    'name': item.get_actor_name(),
                },
            } for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'actor': attrs['actor'],
            'event': obj.get_event_display(),
            'ipAddress': obj.ip_address,
            'note': obj.get_note(),
            'dateCreated': obj.datetime,
        }

from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Event


@register(Event)
class EventSerializer(Serializer):
    def _get_entries(self, event, user):
        # XXX(dcramer): These are called entries for future-proofing
        interface_list = []
        for key, interface in event.interfaces.iteritems():
            if key == 'user':
                continue
            entry = {
                'data': interface.to_json(),
                'type': interface.get_alias(),
            }
            interface_list.append((interface, entry))
        interface_list.sort(key=lambda x: x[0].get_display_score(), reverse=True)

        return [i[1] for i in interface_list]

    def get_attrs(self, item_list, user):
        Event.objects.bind_nodes(item_list, 'data')

        results = {}
        for item in item_list:
            user_interface = item.interfaces.get('sentry.interfaces.User')
            if user_interface:
                user_data = user_interface.to_json()
            else:
                user_data = None

            results[item] = {
                'entries': self._get_entries(item, user),
                'user': user_data,
            }
        return results

    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'eventID': str(obj.event_id),
            'entries': attrs['entries'],
            'message': obj.message,
            'user': attrs['user'],
            'context': obj.data.get('extra', {}),
            'tags': obj.get_tags(),
            'platform': obj.platform,
            'dateCreated': obj.datetime,
            'timeSpent': obj.time_spent,
        }
        return d

from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Event, EventError


@register(Event)
class EventSerializer(Serializer):
    def _get_entries(self, event, user, is_public=False):
        # XXX(dcramer): These are called entries for future-proofing
        interface_list = []
        for key, interface in event.interfaces.iteritems():
            # we treat user as a special contextual item
            if key == 'sentry.interfaces.User':
                continue

            entry = {
                'data': interface.get_api_context(is_public=is_public),
                'type': interface.get_alias(),
            }
            interface_list.append((interface, entry))
        interface_list.sort(key=lambda x: x[0].get_display_score(), reverse=True)

        return [i[1] for i in interface_list]

    def get_attrs(self, item_list, user, is_public=False):
        Event.objects.bind_nodes(item_list, 'data')

        results = {}
        for item in item_list:
            user_interface = item.interfaces.get('sentry.interfaces.User')
            if user_interface:
                user_data = user_interface.to_json()
            else:
                user_data = None

            results[item] = {
                'entries': self._get_entries(item, user, is_public=is_public),
                'user': user_data,
            }
        return results

    def serialize(self, obj, attrs, user):
        errors = []
        error_set = set()
        for error in obj.data.get('errors', []):
            message = EventError.get_message(error)
            if message in error_set:
                continue
            error_set.add(message)
            error_result = {
                'type': error['type'],
                'message': message,
                'data': {
                    k: v for k, v in error.items()
                    if k != 'type'
                },
            }
            errors.append(error_result)

        tags = sorted([
            {
                'key': k.split('sentry:', 1)[-1],
                'value': v
            } for k, v in obj.get_tags()
        ], key=lambda x: x['key'])

        # TODO(dcramer): move release serialization here
        d = {
            'id': str(obj.id),
            'groupID': obj.group.id,
            'eventID': str(obj.event_id),
            'size': obj.size,
            'entries': attrs['entries'],
            'message': obj.message,
            'user': attrs['user'],
            'context': obj.data.get('extra', {}),
            'packages': obj.data.get('modules', {}),
            'tags': tags,
            'platform': obj.platform,
            'dateCreated': obj.datetime,
            'timeSpent': obj.time_spent,
            'errors': errors,
        }
        return d


class SharedEventSerializer(EventSerializer):
    def get_attrs(self, item_list, user):
        return super(SharedEventSerializer, self).get_attrs(
            item_list, user, is_public=True
        )

    def serialize(self, obj, attrs, user):
        result = super(SharedEventSerializer, self).serialize(obj, attrs, user)
        del result['context']
        del result['user']
        del result['tags']
        return result

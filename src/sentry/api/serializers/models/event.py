from __future__ import absolute_import

import six

from datetime import datetime
from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.models import Event, EventError


@register(Event)
class EventSerializer(Serializer):
    _reserved_keys = frozenset([
        'sentry.interfaces.User', 'sdk', 'device',
        'contexts'
    ])

    def _get_entries(self, event, user, is_public=False):
        # XXX(dcramer): These are called entries for future-proofing
        interface_list = []
        for key, interface in six.iteritems(event.interfaces):
            # we treat user as a special contextual item
            if key in self._reserved_keys:
                continue

            data = interface.get_api_context(is_public=is_public)
            # data might not be returned for e.g. a public HTTP repr
            if not data:
                continue

            entry = {
                'data': data,
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
            # TODO(dcramer): convert to get_api_context
            if user_interface:
                user_data = user_interface.to_json()
            else:
                user_data = None

            contexts_interface = item.interfaces.get('contexts')
            if contexts_interface:
                contexts_data = contexts_interface.get_api_context()
            else:
                contexts_data = {}

            sdk_interface = item.interfaces.get('sdk')
            if sdk_interface:
                sdk_data = sdk_interface.get_api_context()
                # we restrict SDK information to superusers due to the nature of
                # privacy laws and IP sensitivity
                # TODO(dcramer): make this respect 'enhanced privacy' org flag
                if not user.is_superuser:
                    sdk_data.pop('clientIP', None)
            else:
                sdk_data = None

            results[item] = {
                'entries': self._get_entries(item, user, is_public=is_public),
                'user': user_data,
                'contexts': contexts_data,
                'sdk': sdk_data,
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
                    k: v for k, v in six.iteritems(error)
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

        received = obj.data.get('received')
        if received:
            # Sentry at one point attempted to record invalid types here.
            # Remove after June 2 2016
            try:
                received = datetime.utcfromtimestamp(received).replace(
                    tzinfo=timezone.utc,
                )
            except TypeError:
                received = None

        # TODO(dcramer): move release serialization here
        d = {
            'id': six.text_type(obj.id),
            'groupID': six.text_type(obj.group_id),
            'eventID': six.text_type(obj.event_id),
            'size': obj.size,
            'entries': attrs['entries'],
            # See GH-3248
            'message': obj.get_legacy_message(),
            'user': attrs['user'],
            'contexts': attrs['contexts'],
            'sdk': attrs['sdk'],
            # TODO(dcramer): move into contexts['extra']
            'context': obj.data.get('extra', {}),
            'packages': obj.data.get('modules', {}),
            'type': obj.get_event_type(),
            'metadata': obj.get_event_metadata(),
            'tags': tags,
            'platform': obj.platform,
            'dateCreated': obj.datetime,
            'dateReceived': received,
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
        del result['contexts']
        del result['user']
        del result['tags']
        del result['sdk']
        del result['errors']
        result['entries'] = [
            e for e in result['entries']
            if e['type'] != 'breadcrumbs'
        ]
        return result

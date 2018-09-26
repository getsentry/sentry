from __future__ import absolute_import

import six

from datetime import datetime
from django.utils import timezone

from semaphore import meta_with_chunks
from sentry.api.serializers import Serializer, register
from sentry.models import Event, EventError


@register(Event)
class EventSerializer(Serializer):
    _reserved_keys = frozenset(
        ['user', 'sdk', 'device', 'contexts'])

    def _get_entries(self, event, user, is_public=False):
        # XXX(dcramer): These are called entries for future-proofing

        meta = event.data.get('_meta') or {}
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

            api_meta = None
            if meta.get(key):
                api_meta = interface.get_api_meta(meta[key], is_public=is_public)

            interface_list.append((interface, entry, api_meta))

        interface_list.sort(
            key=lambda x: x[0].get_display_score(), reverse=True)

        return (
            [i[1] for i in interface_list],
            {k: {'data': i[2]} for k, i in enumerate(interface_list)}
        )

    def _get_interface_with_meta(self, event, name, is_public=False):
        interface = event.interfaces.get(name)
        if not interface:
            return (None, None)

        data = interface.get_api_context(is_public=is_public)
        event_meta = event.data.get('_meta') or {}
        if not data or not event_meta.get(name):
            return (data, None)

        api_meta = interface.get_api_meta(event_meta[name], is_public=is_public)
        # data might not be returned for e.g. a public HTTP repr
        if not api_meta:
            return (data, None)

        return (data, meta_with_chunks(data, api_meta))

    def get_attrs(self, item_list, user, is_public=False):
        Event.objects.bind_nodes(item_list, 'data')

        results = {}
        for item in item_list:
            # TODO(dcramer): convert to get_api_context
            (user_data, user_meta) = self._get_interface_with_meta(item, 'user', is_public)
            (contexts_data, contexts_meta) = self._get_interface_with_meta(item, 'contexts', is_public)
            (sdk_data, sdk_meta) = self._get_interface_with_meta(item, 'sdk', is_public)

            (entries, entries_meta) = self._get_entries(item, user, is_public=is_public)

            results[item] = {
                'entries': entries,
                'user': user_data,
                'contexts': contexts_data or {},
                'sdk': sdk_data,
                '_meta': {
                    'entries': entries_meta,
                    'user': user_meta,
                    'contexts': contexts_meta,
                    'sdk': sdk_meta,
                }
            }
        return results

    def serialize(self, obj, attrs, user):
        errors = []
        for error in obj.data.get('errors', []):
            message = EventError.get_message(error)
            error_result = {
                'type': error['type'],
                'message': message,
                'data': {k: v for k, v in six.iteritems(error) if k != 'type'},
            }
            errors.append(error_result)

        tags = sorted(
            [{
                'key': k.split('sentry:', 1)[-1],
                'value': v
            } for k, v in obj.get_tags()],
            key=lambda x: x['key']
        )

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

        from sentry.event_manager import (
            get_hashes_from_fingerprint,
            md5_from_hash,
        )

        # TODO(dcramer): move release serialization here
        d = {
            'id': six.text_type(obj.id),
            'groupID': six.text_type(obj.group_id),
            'eventID': six.text_type(obj.event_id),
            'size': obj.size,
            'entries': attrs['entries'],
            'dist': obj.dist,
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
            'fingerprints': [
                md5_from_hash(h)
                for h in get_hashes_from_fingerprint(obj, obj.data.get('fingerprint', ['{{ default }}']))
            ],
            '_meta': dict(**attrs['_meta'])
        }
        return d


class SharedEventSerializer(EventSerializer):
    def get_attrs(self, item_list, user):
        return super(SharedEventSerializer, self).get_attrs(item_list, user, is_public=True)

    def serialize(self, obj, attrs, user):
        result = super(SharedEventSerializer, self).serialize(obj, attrs, user)
        del result['context']
        del result['contexts']
        del result['user']
        del result['tags']
        del result['sdk']
        del result['errors']
        result['entries'] = [e for e in result['entries']
                             if e['type'] != 'breadcrumbs']
        return result

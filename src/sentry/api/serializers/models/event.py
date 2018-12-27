from __future__ import absolute_import

import six

from datetime import datetime
from django.utils import timezone
from semaphore import meta_with_chunks

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Event, EventError, EventAttachment
from sentry.utils.safe import get_path


CRASH_FILE_TYPES = set(['event.minidump'])


def get_crash_files(events):
    event_ids = [x.event_id for x in events if x.platform == 'native']
    rv = {}
    if event_ids:
        attachments = EventAttachment.objects.filter(
            event_id__in=event_ids,
        ).select_related('file')
        for attachment in attachments:
            if attachment.file.type in CRASH_FILE_TYPES:
                rv[attachment.event_id] = attachment
    return rv


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
                'type': interface.external_type,
            }

            api_meta = None
            if meta.get(key):
                api_meta = interface.get_api_meta(meta[key], is_public=is_public)
                api_meta = meta_with_chunks(data, api_meta)

            interface_list.append((interface, entry, api_meta))

        interface_list.sort(
            key=lambda x: x[0].get_display_score(), reverse=True)

        return (
            [i[1] for i in interface_list],
            {k: {'data': i[2]} for k, i in enumerate(interface_list) if i[2]}
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

    def _get_tags_with_meta(self, event):
        meta = get_path(event.data, '_meta', 'tags') or {}

        tags = sorted(
            [{
                'key': k.split('sentry:', 1)[-1],
                'value': v,
                '_meta': meta.get(k) or get_path(meta, six.text_type(i), '1') or None,
            } for i, (k, v) in enumerate(event.data.get('tags') or ())],
            key=lambda x: x['key']
        )

        tags_meta = {
            six.text_type(i): {'value': e.pop('_meta')}
            for i, e in enumerate(tags) if e.get('_meta')
        }

        return (tags, meta_with_chunks(tags, tags_meta))

    def _get_attr_with_meta(self, event, attr, default=None):
        value = event.data.get(attr, default)
        meta = get_path(event.data, '_meta', attr)
        return (value, meta_with_chunks(value, meta))

    def _get_legacy_message_with_meta(self, event):
        meta = event.data.get('_meta')

        message = get_path(event.data, 'logentry', 'formatted')
        msg_meta = get_path(meta, 'logentry', 'formatted')

        if not message:
            message = get_path(event.data, 'logentry', 'message')
            msg_meta = get_path(meta, 'logentry', 'message')

        if not message:
            message = event.message
            msg_meta = None

        return (message, meta_with_chunks(message, msg_meta))

    def get_attrs(self, item_list, user, is_public=False):
        Event.objects.bind_nodes(item_list, 'data')

        crash_files = get_crash_files(item_list)
        results = {}
        for item in item_list:
            # TODO(dcramer): convert to get_api_context
            (user_data, user_meta) = self._get_interface_with_meta(item, 'user', is_public)
            (contexts_data, contexts_meta) = self._get_interface_with_meta(item, 'contexts', is_public)
            (sdk_data, sdk_meta) = self._get_interface_with_meta(item, 'sdk', is_public)

            (entries, entries_meta) = self._get_entries(item, user, is_public=is_public)

            crash_file = crash_files.get(item.event_id)

            results[item] = {
                'entries': entries,
                'user': user_data,
                'contexts': contexts_data or {},
                'sdk': sdk_data,
                'crash_file': serialize(crash_file, user=user),
                '_meta': {
                    'entries': entries_meta,
                    'user': user_meta,
                    'contexts': contexts_meta,
                    'sdk': sdk_meta,
                }
            }
        return results

    def serialize(self, obj, attrs, user):
        errors = [
            EventError(error).get_api_context() for error
            in get_path(obj.data, 'errors', filter=True, default=())
        ]

        (message, message_meta) = self._get_legacy_message_with_meta(obj)
        (tags, tags_meta) = self._get_tags_with_meta(obj)
        (context, context_meta) = self._get_attr_with_meta(obj, 'extra', {})
        (packages, packages_meta) = self._get_attr_with_meta(obj, 'modules', {})

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
            'dist': obj.dist,
            # See GH-3248
            'message': message,
            'user': attrs['user'],
            'contexts': attrs['contexts'],
            'crashFile': attrs['crash_file'],
            'sdk': attrs['sdk'],
            # TODO(dcramer): move into contexts['extra']
            'context': context,
            'packages': packages,
            'type': obj.get_event_type(),
            'metadata': obj.get_event_metadata(),
            'tags': tags,
            'platform': obj.platform,
            'dateCreated': obj.datetime,
            'dateReceived': received,
            'errors': errors,
            'fingerprints': obj.get_hashes(),
            '_meta': {
                'entries': attrs['_meta']['entries'],
                'message': message_meta,
                'user': attrs['_meta']['user'],
                'contexts': attrs['_meta']['contexts'],
                'sdk': attrs['_meta']['sdk'],
                'context': context_meta,
                'packages': packages_meta,
                'tags': tags_meta,
            },
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


class SnubaEvent(object):
    """
        A simple wrapper class on a row (dict) returned from snuba representing
        an event. Provides a class name to register a serializer against, and
        Makes keys accessible as attributes.
    """

    # The list of columns that we should request from snuba to be able to fill
    # out a proper event object.
    selected_columns = [
        'event_id',
        'project_id',
        'message',
        'user_id',
        'username',
        'ip_address',
        'email',
        'timestamp',
    ]

    def __init__(self, kv):
        assert set(kv.keys()) == set(self.selected_columns)
        self.__dict__ = kv


@register(SnubaEvent)
class SnubaEventSerializer(Serializer):
    """
        A bare-bones version of EventSerializer which uses snuba event rows as
        the source data but attempts to produce a compatible (subset) of the
        serialization returned by EventSerializer.
    """

    def serialize(self, obj, attrs, user):
        return {
            'eventID': six.text_type(obj.event_id),
            'projectID': six.text_type(obj.project_id),
            'message': obj.message,
            'dateCreated': obj.timestamp,
            'user': {
                'id': obj.user_id,
                'email': obj.email,
                'username': obj.username,
                'ipAddress': obj.ip_address,
            }
        }

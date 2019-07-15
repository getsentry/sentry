from __future__ import absolute_import

import six

from datetime import datetime
from django.utils import timezone
from semaphore import meta_with_chunks

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    Event,
    EventError,
    EventAttachment,
    Release,
    UserReport,
    SnubaEvent
)
from sentry.search.utils import convert_user_tag_to_query
from sentry.utils.safe import get_path
from sentry.sdk_updates import get_suggested_updates, SdkSetupState


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


@register(SnubaEvent)
@register(Event)
class EventSerializer(Serializer):
    _reserved_keys = frozenset(
        ['user', 'sdk', 'device', 'contexts'])

    def _get_entries(self, event, user, is_public=False):
        # XXX(dcramer): These are called entries for future-proofing

        platform = event.platform
        meta = event.data.get('_meta') or {}
        interface_list = []

        for key, interface in six.iteritems(event.interfaces):
            # we treat user as a special contextual item
            if key in self._reserved_keys:
                continue

            data = interface.get_api_context(is_public=is_public, platform=platform)
            # data might not be returned for e.g. a public HTTP repr
            if not data:
                continue

            entry = {
                'data': data,
                'type': interface.external_type,
            }

            api_meta = None
            if meta.get(key):
                api_meta = interface.get_api_meta(meta[key], is_public=is_public,
                                                  platform=platform)
                api_meta = meta_with_chunks(data, api_meta)

            interface_list.append((interface, entry, api_meta))

        interface_list.sort(
            key=lambda x: x[0].get_display_score(), reverse=True)

        return (
            [i[1] for i in interface_list],
            {k: {'data': i[2]} for k, i in enumerate(interface_list) if i[2]}
        )

    def _get_interface_with_meta(self, event, name, is_public=False):
        interface = event.get_interface(name)
        if not interface:
            return (None, None)

        platform = event.platform
        data = interface.get_api_context(is_public=is_public, platform=platform)
        event_meta = event.data.get('_meta') or {}
        if not data or not event_meta.get(name):
            return (data, None)

        api_meta = interface.get_api_meta(event_meta[name], is_public=is_public,
                                          platform=platform)
        # data might not be returned for e.g. a public HTTP repr
        if not api_meta:
            return (data, None)

        return (data, meta_with_chunks(data, api_meta))

    def _get_tags_with_meta(self, event):
        meta = get_path(event.data, '_meta', 'tags') or {}

        # If we have meta, we need to get the tags in their original order
        # from the raw event body as the indexes need to line up with the
        # metadata indexes. In other cases we can use event.tags
        if meta:
            raw_tags = event.data.get('tags') or []
        else:
            raw_tags = event.tags

        tags = sorted(
            [
                {
                    'key': kv[0].split('sentry:', 1)[-1],
                    'value': kv[1],
                    '_meta': meta.get(kv[0]) or get_path(meta, six.text_type(i), '1') or None,
                }
                for i, kv in enumerate(raw_tags)
                if kv is not None and kv[0] is not None and kv[1] is not None],
            key=lambda x: x['key']
        )

        # Add 'query' for each tag to tell the UI what to use as query
        # params for this tag.
        for tag in tags:
            query = convert_user_tag_to_query(tag['key'], tag['value'])
            if query:
                tag['query'] = query

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

    def _get_release_info(self, user, event):
        version = event.get_tag('sentry:release')
        if not version:
            return None
        try:
            release = Release.objects.get(
                projects=event.project,
                organization_id=event.project.organization_id,
                version=version,
            )
        except Release.DoesNotExist:
            return {'version': version}
        return serialize(release, user)

    def _get_user_report(self, user, event):
        try:
            user_report = UserReport.objects.get(
                event_id=event.event_id,
                project=event.project,
            )
        except UserReport.DoesNotExist:
            user_report = None
        return serialize(user_report, user)

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

    def should_display_error(self, error):
        name = error.get('name')
        if not isinstance(name, six.string_types):
            return True

        return not name.startswith('breadcrumbs.') \
            and not name.startswith('extra.') \
            and '.frames.' not in name

    def serialize(self, obj, attrs, user):
        errors = [
            EventError(error).get_api_context() for error
            in get_path(obj.data, 'errors', filter=True, default=())
            # TODO(ja): Temporary workaround to hide certain normalization errors.
            # Remove this and the test in tests/sentry/api/serializers/test_event.py
            if self.should_display_error(error)
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

        d = {
            'id': six.text_type(obj.id),
            'groupID': six.text_type(obj.group_id) if obj.group_id else None,
            'eventID': six.text_type(obj.event_id),
            'projectID': six.text_type(obj.project_id),
            'size': obj.size,
            'entries': attrs['entries'],
            'dist': obj.dist,
            # See GH-3248
            'message': message,
            'title': obj.title,
            'location': obj.location,
            'culprit': obj.culprit,
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
            'groupingConfig': obj.get_grouping_config(),
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
        # transaction events have start and end-times that are
        # timestamp floats.
        if obj.get_event_type() == 'transaction':
            d['startTimestamp'] = obj.data.get('start_timestamp')
            d['timestamp'] = obj.data.get('timestamp')
        return d


class DetailedEventSerializer(EventSerializer):
    """
    Adds release and user report info to the serialized event.
    """

    def _get_sdk_updates(self, obj):
        return list(get_suggested_updates(SdkSetupState.from_event_json(obj.data)))

    def serialize(self, obj, attrs, user):
        result = super(DetailedEventSerializer, self).serialize(obj, attrs, user)
        result['release'] = self._get_release_info(user, obj)
        result['userReport'] = self._get_user_report(user, obj)
        result['sdkUpdates'] = self._get_sdk_updates(obj)
        return result


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


class SimpleEventSerializer(EventSerializer):
    """
    Simple event serializer that renders a basic outline of an event without
    most interfaces/breadcrumbs. This can be used for basic event list queries
    where we don't need the full detail. The side effect is that, if the
    serialized events are actually SnubaEvents, we can render them without
    needing to fetch the event bodies from nodestore.

    NB it would be super easy to inadvertently add a property accessor here
    that would require a nodestore lookup for a SnubaEvent serialized using
    this serializer. You will only really notice you've done this when the
    organization event search API gets real slow.
    """

    def get_attrs(self, item_list, user):
        crash_files = get_crash_files(item_list)
        return {
            event: {
                'crash_file': serialize(crash_files.get(event.event_id), user=user)
            }
            for event in item_list
        }

    def serialize(self, obj, attrs, user):
        tags = [{
            'key': key.split('sentry:', 1)[-1],
            'value': value,
        } for key, value in obj.tags]
        for tag in tags:
            query = convert_user_tag_to_query(tag['key'], tag['value'])
            if query:
                tag['query'] = query

        user = obj.get_minimal_user()

        return {
            'id': six.text_type(obj.id),
            'event.type': six.text_type(obj.type),
            'groupID': six.text_type(obj.group_id) if obj.group_id else None,
            'eventID': six.text_type(obj.event_id),
            'projectID': six.text_type(obj.project_id),
            # XXX for 'message' this doesn't do the proper resolution of logentry
            # etc. that _get_legacy_message_with_meta does.
            'message': obj.message,
            'title': obj.title,
            'location': obj.location,
            'culprit': obj.culprit,
            'user': user and user.get_api_context(),
            'tags': tags,
            'platform': obj.platform,
            'dateCreated': obj.datetime,

            # Needed to generate minidump links in UI
            'crashFile': attrs['crash_file'],
        }

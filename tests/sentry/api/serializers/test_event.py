# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize, SimpleEventSerializer
from sentry.api.serializers.models.event import (
    SharedEventSerializer,
    SnubaEvent,
)
from sentry.models import EventError
from sentry.testutils import TestCase
from sentry.utils.samples import load_data


class EventSerializerTest(TestCase):
    def test_simple(self):
        event = self.create_event(event_id='a')

        result = serialize(event)
        assert result['id'] == six.text_type(event.id)
        assert result['eventID'] == 'a'

    def test_eventerror(self):
        event = self.create_event(
            data={
                'errors': [{
                    'type': EventError.INVALID_DATA,
                    'name': u'ü',
                }],
            }
        )

        result = serialize(event)
        assert len(result['errors']) == 1
        assert 'data' in result['errors'][0]
        assert result['errors'][0]['type'] == EventError.INVALID_DATA
        assert result['errors'][0]['data'] == {'name': u'ü'}

    def test_hidden_eventerror(self):
        event = self.create_event(
            data={
                'errors': [{
                    'type': EventError.INVALID_DATA,
                    'name': u'breadcrumbs.values.42.data',
                }, {
                    'type': EventError.INVALID_DATA,
                    'name': u'exception.values.0.stacktrace.frames.42.vars',
                }],
            }
        )

        result = serialize(event)
        assert result['errors'] == []

    def test_renamed_attributes(self):
        # Only includes meta for simple top-level attributes
        event = self.create_event(
            data={
                'extra': {'extra': True},
                'modules': {'modules': 'foobar'},
                '_meta': {
                    'extra': {'': {'err': ['extra error']}},
                    'modules': {'': {'err': ['modules error']}},
                }
            }
        )

        result = serialize(event)
        assert result['context'] == {'extra': True}
        assert result['_meta']['context'] == {'': {'err': ['extra error']}}
        assert result['packages'] == {'modules': 'foobar'}
        assert result['_meta']['packages'] == {'': {'err': ['modules error']}}

    def test_message_interface(self):
        event = self.create_event(
            data={
                'logentry': {'formatted': 'bar'},
                '_meta': {
                    'logentry': {
                        'formatted': {'': {'err': ['some error']}},
                    },
                },
            }
        )

        result = serialize(event)
        assert result['message'] == 'bar'
        assert result['_meta']['message'] == {'': {'err': ['some error']}}

    def test_message_formatted(self):
        event = self.create_event(
            data={
                'logentry': {'message': 'bar', 'formatted': 'baz'},
                '_meta': {
                    'logentry': {
                        'formatted': {'': {'err': ['some error']}},
                    },
                },
            }
        )

        result = serialize(event)
        assert result['message'] == 'baz'
        assert result['_meta']['message'] == {'': {'err': ['some error']}}

    def test_message_legacy(self):
        event = self.create_event(data={'logentry': None})
        event.message = 'search message'

        result = serialize(event)
        assert result['message'] == 'search message'

    def test_tags_tuples(self):
        event = self.create_event(
            data={
                'tags': [
                    ['foo', 'foo'],
                    ['bar', 'bar'],
                ],
                '_meta': {
                    'tags': {
                        '0': {
                            '1': {'': {'err': ['foo error']}},
                        },
                        '1': {
                            '1': {'': {'err': ['bar error']}},
                        },
                    },
                },
            }
        )

        result = serialize(event)
        assert result['tags'][0]['value'] == 'bar'
        assert result['tags'][1]['value'] == 'foo'
        assert result['_meta']['tags']['0']['value'] == {'': {'err': ['bar error']}}
        assert result['_meta']['tags']['1']['value'] == {'': {'err': ['foo error']}}

    def test_tags_dict(self):
        event = self.create_event(
            data={
                # Sentry normalizes this internally
                'tags': {
                    'foo': 'foo',
                    'bar': 'bar',
                },
                '_meta': {
                    'tags': {
                        'foo': {'': {'err': ['foo error']}},
                        'bar': {'': {'err': ['bar error']}},
                    },
                },
            }
        )

        result = serialize(event)
        assert result['tags'][0]['value'] == 'bar'
        assert result['tags'][1]['value'] == 'foo'
        assert result['_meta']['tags']['0']['value'] == {'': {'err': ['bar error']}}
        assert result['_meta']['tags']['1']['value'] == {'': {'err': ['foo error']}}

    def test_none_interfaces(self):
        event = self.create_event(data={
            'breadcrumbs': None,
            'exception': None,
            'logentry': None,
            'request': None,
            'user': None,
            'contexts': None,
            'sdk': None,
            '_meta': None,
        })

        result = serialize(event)
        assert not any(e['type'] == 'breadcrumbs' for e in result['entries'])
        assert not any(e['type'] == 'exception' for e in result['entries'])
        assert not any(e['type'] == 'message' for e in result['entries'])
        assert not any(e['type'] == 'request' for e in result['entries'])
        assert result['user'] is None
        assert result['sdk'] is None
        assert result['contexts'] == {}

    def test_transaction_event(self):
        event_data = load_data('transaction')
        event = self.store_event(
            data=event_data,
            project_id=self.project.id
        )
        result = serialize(event)
        assert result['timestamp'] == event.data.get('timestamp')
        assert isinstance(result['timestamp'], float)
        assert result['startTimestamp'] == event.data.get('start_timestamp')
        assert isinstance(result['startTimestamp'], float)


class SharedEventSerializerTest(TestCase):
    def test_simple(self):
        event = self.create_event(event_id='a')

        result = serialize(event, None, SharedEventSerializer())
        assert result['id'] == six.text_type(event.id)
        assert result['eventID'] == 'a'
        assert result.get('context') is None
        assert result.get('contexts') is None
        assert result.get('user') is None
        assert result.get('tags') is None
        assert 'sdk' not in result
        assert 'errors' not in result
        for entry in result['entries']:
            assert entry['type'] != 'breadcrumbs'


class SimpleEventSerializerTest(TestCase):
    def test_user(self):
        """
        Use the SimpleEventSerializer to serialize an event
        """

        group = self.create_group()
        event = SnubaEvent({
            'event_id': 'a',
            'project_id': 1,
            'message': 'hello there',
            'title': 'hi',
            'type': 'default',
            'location': 'somewhere',
            'culprit': 'foo',
            'timestamp': '2011-01-01T00:00:00Z',
            'user_id': '123',
            'email': 'test@test.com',
            'username': 'test',
            'ip_address': '192.168.0.1',
            'platform': 'asdf',
            'group_id': group.id,
            'tags.key': ['sentry:user'],
            'tags.value': ['email:test@test.com'],
        })
        result = serialize(event, None, SimpleEventSerializer())

        # Make sure we didn't have to call out to Nodestore to get the data
        # required to serialize this event and the NodeData is still empty.
        assert event.data._node_data is None, "SimpleEventSerializer should not load Nodestore data."

        assert result['eventID'] == event.event_id
        assert result['projectID'] == six.text_type(event.project_id)
        assert result['groupID'] == six.text_type(group.id)
        assert result['message'] == event.message
        assert result['title'] == event.title
        assert result['location'] == event.location
        assert result['culprit'] == event.culprit
        assert result['dateCreated'] == event.datetime
        assert result['user']['id'] == event.user_id
        assert result['user']['email'] == event.email
        assert result['user']['username'] == event.username
        assert result['user']['ip_address'] == event.ip_address
        assert result['tags'] == [{
            'key': 'user',
            'value': 'email:test@test.com',
            'query': 'user.email:test@test.com',
        }]

    def test_no_group(self):
        """
        Use the SimpleEventSerializer to serialize an event without group
        """

        event = SnubaEvent({
            'event_id': 'a',
            'project_id': 1,
            'message': 'hello there',
            'title': 'hi',
            'type': 'default',
            'location': 'somewhere',
            'culprit': 'foo',
            'timestamp': '2011-01-01T00:00:00Z',
            'user_id': '123',
            'email': 'test@test.com',
            'username': 'test',
            'ip_address': '192.168.0.1',
            'platform': 'asdf',
            'group_id': None,
            'tags.key': ['sentry:user'],
            'tags.value': ['email:test@test.com'],
        })
        result = serialize(event, None, SimpleEventSerializer())
        assert result['groupID'] is None

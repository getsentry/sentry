# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import SharedEventSerializer
from sentry.testutils import TestCase
from sentry.models import EventError


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
        assert u'ü' in result['errors'][0]['message']
        assert result['errors'][0]['data'] == {'name': u'ü'}

    def test_renamed_attributes(self):
        # Only includes meta for simple top-level attributes
        event = self.create_event(
            data={
                'extra': {'extra': True},
                'modules': {'modules': True},
                '_meta': {
                    'extra': {'': {'err': ['extra error']}},
                    'modules': {'': {'err': ['modules error']}},
                }
            }
        )

        result = serialize(event)
        assert result['context'] == {'extra': True}
        assert result['_meta']['context'] == {'': {'err': ['extra error']}}
        assert result['packages'] == {'modules': True}
        assert result['_meta']['packages'] == {'': {'err': ['modules error']}}

    def test_message_interface(self):
        event = self.create_event(
            data={
                'logentry': {'message': 'bar'},
                '_meta': {
                    'logentry': {
                        'message': {'': {'err': ['some error']}},
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
        # TODO: This test case can be removed once validation is implemented by
        # libsemaphore and enforced on all payloads
        event = self.create_event(
            data={
                'message': 'foo',
                '_meta': {
                    'message': {'': {'err': ['some error']}},
                },
            }
        )

        # create_event automatically creates the logentry interface
        del event.data['logentry']

        result = serialize(event)
        assert result['message'] == 'foo'
        assert result['_meta']['message'] == {'': {'err': ['some error']}}

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
                # Sentry normalizes this internally, it is actually passed in as
                # object {"foo": "foo", "bar": "bar"}
                'tags': [
                    ['foo', 'foo'],
                    ['bar', 'bar'],
                ],
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

# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.testutils import TestCase
from sentry.models import EventError


class EventSerializerTest(TestCase):
    def test_simple(self):
        event = self.create_event(event_id='a')

        result = serialize(event)
        assert result['id'] == six.text_type(event.id)
        assert result['eventID'] == 'a'

    def test_eventerror(self):
        event = self.create_event(data={
            'errors': [{
                'type': EventError.INVALID_DATA,
                'name': u'ü',
            }],
        })

        result = serialize(event)
        assert len(result['errors']) == 1
        assert 'data' in result['errors'][0]
        assert result['errors'][0]['type'] == EventError.INVALID_DATA
        assert u'ü' in result['errors'][0]['message']
        assert result['errors'][0]['data'] == {'name': u'ü'}

from __future__ import absolute_import

from datetime import datetime
import pytest
import pytz

from sentry.analytics import Attribute, Event, Map
from sentry.testutils import TestCase


class ExampleEvent(Event):
    type = 'example'

    attributes = (
        Attribute('id', type=int), Map('map', (Attribute('key'), )),
        Attribute('optional', type=bool, required=False),
    )


class DummyType(object):
    key = 'value'


class EventTest(TestCase):
    def test_simple(self):
        result = ExampleEvent(
            id='1',
            map={'key': 'value'},
            optional=False,
            datetime=datetime(2001, 4, 18, tzinfo=pytz.utc)
        )
        assert result.data == {
            'id': 1,
            'map': {
                'key': 'value',
            },
            'optional': False,
        }
        assert result.serialize() == {
            'id': 1,
            'map': {
                'key': 'value',
            },
            'optional': False,
            'type': 'example',
            'timestamp': 987552000,
        }

    def test_optional_is_optional(self):
        result = ExampleEvent(id='1', map={'key': 'value'})
        assert result.data == {
            'id': 1,
            'map': {
                'key': 'value',
            },
            'optional': None,
        }

    def test_required_cannot_be_none(self):
        with pytest.raises(ValueError):
            ExampleEvent(
                id='1',
                map={'key': None},
            )

    def test_invalid_map(self):
        with pytest.raises(ValueError):
            ExampleEvent(id='1', map='foo')

    def test_map_with_instance(self):
        result = ExampleEvent(id='1', map=DummyType())
        assert result.data['map'] == {
            'key': 'value',
        }

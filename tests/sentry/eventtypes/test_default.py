from __future__ import absolute_import

from sentry.eventtypes import DefaultEvent
from sentry.testutils import TestCase


class DefaultEventTest(TestCase):
    def test_get_metadata(self):
        inst = DefaultEvent({})
        assert inst.get_metadata() == {
            'title': '<unlabeled event>'
        }

        inst = DefaultEvent({
            'logentry': {
                'formatted': '  ',
            }
        })
        assert inst.get_metadata() == {
            'title': '<unlabeled event>'
        }

        inst = DefaultEvent({
            'logentry': {
                'formatted': 'foo',
                'message': 'bar',
            }
        })
        assert inst.get_metadata() == {
            'title': 'foo'
        }

        inst = DefaultEvent({
            'logentry': {
                'message': 'foo',
            }
        })
        assert inst.get_metadata() == {
            'title': 'foo'
        }

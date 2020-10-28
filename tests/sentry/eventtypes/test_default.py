from __future__ import absolute_import

from sentry.eventtypes import DefaultEvent
from sentry.testutils import TestCase


class DefaultEventTest(TestCase):
    def test_get_metadata(self):
        inst = DefaultEvent()
        assert inst.get_metadata({}) == {"title": "<unlabeled event>"}

        inst = DefaultEvent()
        data = {"logentry": {"formatted": "  "}}
        assert inst.get_metadata(data) == {"title": "<unlabeled event>"}

        inst = DefaultEvent()
        data = {"logentry": {"formatted": "foo", "message": "bar"}}
        assert inst.get_metadata(data) == {"title": "foo"}

        inst = DefaultEvent()
        data = {"logentry": {"message": "foo"}}
        assert inst.get_metadata(data) == {"title": "foo"}

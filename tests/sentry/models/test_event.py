from __future__ import absolute_import

from sentry.testutils import TestCase


class EventTest(TestCase):
    def test_legacy_tags(self):
        event = self.create_event(data={
            'tags': [
                ('logger', 'foobar'),
                ('site', 'foo'),
                ('server_name', 'bar'),
            ]
        })
        assert event.logger == 'foobar'
        assert event.level == event.group.level
        assert event.site == 'foo'
        assert event.server_name == 'bar'
        assert event.culprit == event.group.culprit

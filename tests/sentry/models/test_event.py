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

    def test_email_subject(self):
        event1 = self.create_event(
            event_id='a' * 32, group=self.group, tags={'level': 'info'},
            message='Foo bar')
        event2 = self.create_event(
            event_id='b' * 32, group=self.group, tags={'level': 'error'},
            message='Foo bar')
        self.group.level = 30

        assert event1.get_email_subject() == '[foo Bar] INFO: Foo bar'
        assert event2.get_email_subject() == '[foo Bar] ERROR: Foo bar'


class EventGetLegacyMessageTest(TestCase):
    def test_message(self):
        event = self.create_event(message='foo bar')
        assert event.get_legacy_message() == 'foo bar'

    def test_message_interface(self):
        event = self.create_event(
            message='biz baz',
            data={
                'sentry.interfaces.Message': {'message': 'foo bar'}
            },
        )
        assert event.get_legacy_message() == 'foo bar'

    def test_message_interface_with_formatting(self):
        event = self.create_event(
            message='biz baz',
            data={
                'sentry.interfaces.Message': {
                    'message': 'foo %s',
                    'formatted': 'foo bar',
                    'params': ['bar'],
                }
            },
        )
        assert event.get_legacy_message() == 'foo bar'

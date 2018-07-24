from __future__ import absolute_import

import pickle

from sentry.models import Environment, Event
from sentry.testutils import TestCase
from sentry.db.models.fields.node import NodeData


class EventTest(TestCase):
    def test_legacy_tags(self):
        event = self.create_event(
            data={'tags': [
                ('logger', 'foobar'),
                ('site', 'foo'),
                ('server_name', 'bar'),
            ]}
        )
        assert event.logger == 'foobar'
        assert event.level == event.group.level
        assert event.site == 'foo'
        assert event.server_name == 'bar'
        assert event.culprit == event.group.culprit

    def test_pickling_compat(self):
        event = self.create_event(
            data={'tags': [
                ('logger', 'foobar'),
                ('site', 'foo'),
                ('server_name', 'bar'),
            ]}
        )

        # When we pickle an event we need to make sure our canonical code
        # does not appear here or it breaks old workers.
        data = pickle.dumps(event, protocol=2)
        assert 'canonical' not in data

        # For testing we remove the backwards compat support in the
        # `NodeData` as well.
        nodedata_getstate = NodeData.__getstate__
        event_getstate = Event.__getstate__
        event_setstate = Event.__setstate__

        del NodeData.__getstate__
        del Event.__getstate__
        del Event.__setstate__

        # Old worker loading
        try:
            event2 = pickle.loads(data)
            assert event2.data == event.data
        finally:
            NodeData.__getstate__ = nodedata_getstate
            Event.__getstate__ = event_getstate
            Event.__setstate__ = event_setstate

        # New worker loading
        event2 = pickle.loads(data)
        assert event2.data == event.data

    def test_email_subject(self):
        event1 = self.create_event(
            event_id='a' * 32, group=self.group, tags={'level': 'info'}, message='Foo bar'
        )
        event2 = self.create_event(
            event_id='b' * 32, group=self.group, tags={'level': 'ERROR'}, message='Foo bar'
        )
        self.group.level = 30

        assert event1.get_email_subject() == 'BAR-1 - Foo bar'
        assert event2.get_email_subject() == 'BAR-1 - Foo bar'

    def test_email_subject_with_template(self):
        self.project.update_option(
            'mail:subject_template',
            '$shortID - ${tag:environment}@${tag:release} $$ $title ${tag:invalid} $invalid'
        )

        event1 = self.create_event(
            event_id='a' * 32,
            group=self.group,
            tags={'level': 'info',
                  'environment': 'production',
                  'sentry:release': '0'},
            message='baz',
        )

        assert event1.get_email_subject() == 'BAR-1 - production@0 $ baz ${tag:invalid} $invalid'

    def test_as_dict_hides_client_ip(self):
        event = self.create_event(
            data={'sdk': {
                'name': 'foo',
                'version': '1.0',
                'client_ip': '127.0.0.1',
            }}
        )
        result = event.as_dict()
        assert result['sdk'] == {
            'name': 'foo',
            'version': '1.0',
        }

    def test_get_environment(self):
        environment = Environment.get_or_create(self.project, 'production')
        event = self.create_event(
            data={'tags': [
                ('environment', 'production'),
            ]}
        )

        event.get_environment() == environment

        with self.assertNumQueries(0):
            event.get_environment() == environment


class EventGetLegacyMessageTest(TestCase):
    def test_message(self):
        event = self.create_event(message='foo bar')
        assert event.get_legacy_message() == 'foo bar'

    def test_message_interface(self):
        event = self.create_event(
            message='biz baz',
            data={'sentry.interfaces.Message': {
                'message': 'foo bar'
            }},
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

from __future__ import absolute_import

import pickle

from sentry.models import Environment
from sentry.testutils import TestCase
from sentry.db.models.fields.node import NodeData
from sentry.event_manager import EventManager


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

        # Ensure we load and memoize the interfaces as well.
        assert len(event.interfaces) > 0

        # When we pickle an event we need to make sure our canonical code
        # does not appear here or it breaks old workers.
        data = pickle.dumps(event, protocol=2)
        assert 'canonical' not in data

        # For testing we remove the backwards compat support in the
        # `NodeData` as well.
        nodedata_getstate = NodeData.__getstate__
        del NodeData.__getstate__

        # Old worker loading
        try:
            event2 = pickle.loads(data)
            assert event2.data == event.data
        finally:
            NodeData.__getstate__ = nodedata_getstate

        # New worker loading
        event2 = pickle.loads(data)
        assert event2.data == event.data

    def test_event_as_dict(self):
        event = self.create_event(
            data={
                'logentry': {
                    'message': 'Hello World!',
                },
            }
        )

        d = event.as_dict()
        assert d['logentry'] == {
            'message': 'Hello World!',
        }

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

    def test_ip_address(self):
        event = self.create_event(data={
            'user': {'ip_address': '127.0.0.1'},
            'request': {'url': 'http://some.com', 'env': {'REMOTE_ADDR': '::1'}}
        })
        assert event.ip_address == '127.0.0.1'

        event = self.create_event(data={
            'user': {'ip_address': None},
            'request': {'url': 'http://some.com', 'env': {'REMOTE_ADDR': '::1'}}
        })
        assert event.ip_address == '::1'

        event = self.create_event(data={
            'user': None,
            'request': {'url': 'http://some.com', 'env': {'REMOTE_ADDR': '::1'}}
        })
        assert event.ip_address == '::1'

        event = self.create_event(data={
            'request': {'url': 'http://some.com', 'env': {'REMOTE_ADDR': '::1'}}
        })
        assert event.ip_address == '::1'

        event = self.create_event(data={
            'request': {'url': 'http://some.com', 'env': {'REMOTE_ADDR': None}}
        })
        assert event.ip_address is None

        event = self.create_event()
        assert event.ip_address is None


class EventGetLegacyMessageTest(TestCase):
    def test_message(self):
        event = self.create_event(message='foo bar')
        assert event.get_legacy_message() == 'foo bar'

    def test_message_interface(self):
        event = self.create_event(
            message='biz baz',
            data={'logentry': {
                'message': 'foo bar'
            }},
        )
        assert event.get_legacy_message() == 'foo bar'

    def test_message_interface_with_formatting(self):
        event = self.create_event(
            message='biz baz',
            data={
                'logentry': {
                    'message': 'foo %s',
                    'formatted': 'foo bar',
                    'params': ['bar'],
                }
            },
        )
        assert event.get_legacy_message() == 'foo bar'

    def test_none(self):
        event = self.create_event(
            data={'logentry': None},
        )
        assert event.get_legacy_message() == '<unlabeled event>'

        event = self.create_event(
            data={'logentry': {
                'formatted': None,
                'message': None,
            }},
        )
        assert event.get_legacy_message() == '<unlabeled event>'

    def test_get_hashes(self):
        manager = EventManager({'message': 'Hello World!'})
        manager.normalize()
        event = manager.save(1)

        # Have hashes by default
        hashes = event.get_hashes()
        assert hashes == ['ed076287532e86365e841e92bfc50d8c']
        assert event.data.data['hashes'] == ['ed076287532e86365e841e92bfc50d8c']

        # if hashes are reset, generate new ones
        event.data.data['hashes'] = None
        hashes = event.get_hashes()
        assert hashes == ['ed076287532e86365e841e92bfc50d8c']
        assert event.data.data['hashes'] is None

        # Use stored hashes
        event.data.data['hashes'] = ['x']
        assert event.get_hashes() == ['x']

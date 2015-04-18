# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import logging

from mock import patch

from django.conf import settings

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.event_manager import EventManager, get_hashes_for_event
from sentry.models import Event, Group, GroupStatus, EventMapping
from sentry.testutils import TestCase, TransactionTestCase


class EventManagerTest(TransactionTestCase):
    def make_event(self, **kwargs):
        result = {
            'event_id': 'a' * 32,
            'message': 'foo',
            'timestamp': 1403007314.570599,
            'level': logging.ERROR,
            'logger': 'default',
            'tags': [],
        }
        result.update(kwargs)
        return result

    @patch('sentry.signals.regression_signal.send')
    def test_broken_regression_signal(self, send):
        send.side_effect = Exception()

        manager = EventManager(self.make_event())
        event = manager.save(1)

        assert event.message == 'foo'
        assert event.project_id == 1

    @patch('sentry.event_manager.should_sample')
    def test_saves_event_mapping_when_sampled(self, should_sample):
        should_sample.return_value = True
        event_id = 'a' * 32

        manager = EventManager(self.make_event())
        event = manager.save(1)

        assert EventMapping.objects.filter(
            group=event.group, event_id=event_id).exists()

    def test_tags_as_list(self):
        manager = EventManager(self.make_event(tags=[('foo', 'bar')]))
        data = manager.normalize()

        assert data['tags'] == [('foo', 'bar')]

    def test_tags_as_dict(self):
        manager = EventManager(self.make_event(tags={'foo': 'bar'}))
        data = manager.normalize()

        assert data['tags'] == [('foo', 'bar')]

    def test_interface_is_relabeled(self):
        manager = EventManager(self.make_event(user={'id': '1'}))
        data = manager.normalize()

        assert data['sentry.interfaces.User'] == {'id': '1'}
        assert 'user' not in data

    def test_platform_is_saved(self):
        manager = EventManager(self.make_event(platform='python'))
        event = manager.save(1)

        group = event.group
        assert group.platform == 'python'
        assert event.platform == 'python'

    def test_dupe_message_id(self):
        event_id = 'a' * 32

        manager = EventManager(self.make_event(event_id='a' * 32))
        manager.save(1)

        assert Event.objects.count() == 1

        # ensure that calling it again doesn't raise a db error
        manager = EventManager(self.make_event(event_id='a' * 32))
        manager.save(1)

        assert Event.objects.count() == 1

    def test_updates_group(self):
        manager = EventManager(self.make_event(
            message='foo', event_id='a' * 32,
            checksum='a' * 32,
        ))
        event = manager.save(1)

        manager = EventManager(self.make_event(
            message='foo bar', event_id='b' * 32,
            checksum='a' * 32,
        ))
        with self.tasks():
            event2 = manager.save(1)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen.replace(microsecond=0) == event.datetime.replace(microsecond=0)
        assert group.message == event2.message

    def test_unresolves_group(self):
        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1. MySQL doesn't support microseconds.
        manager = EventManager(self.make_event(
            event_id='a' * 32, checksum='a' * 32,
            timestamp=1403007314,
        ))
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(self.make_event(
            event_id='b' * 32, checksum='a' * 32,
            timestamp=1403007345,
        ))
        event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert not group.is_resolved()

    @patch('sentry.event_manager.plugin_is_regression')
    def test_does_not_unresolve_group(self, plugin_is_regression):
        # N.B. EventManager won't unresolve the group unless the event2 has a
        # later timestamp than event1. MySQL doesn't support microseconds.
        plugin_is_regression.return_value = False

        manager = EventManager(self.make_event(
            event_id='a' * 32, checksum='a' * 32,
            timestamp=1403007314,
        ))
        with self.tasks():
            event = manager.save(1)

        group = Group.objects.get(id=event.group_id)
        group.status = GroupStatus.RESOLVED
        group.save()
        assert group.is_resolved()

        manager = EventManager(self.make_event(
            event_id='b' * 32, checksum='a' * 32,
            timestamp=1403007315,
        ))
        event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=group.id)
        assert group.is_resolved()

    @patch('sentry.models.Group.is_resolved')
    def test_unresolves_group_with_auto_resolve(self, mock_is_resolved):
        mock_is_resolved.return_value = False
        manager = EventManager(self.make_event(
            event_id='a' * 32, checksum='a' * 32,
            timestamp=1403007314,
        ))
        with self.tasks():
            event = manager.save(1)

        mock_is_resolved.return_value = True
        manager = EventManager(self.make_event(
            event_id='b' * 32, checksum='a' * 32,
            timestamp=1403007414,
        ))
        with self.tasks():
            event2 = manager.save(1)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group.id)
        assert group.active_at == event2.datetime != event.datetime

    def test_long_culprit(self):
        manager = EventManager(self.make_event(
            culprit='x' * (MAX_CULPRIT_LENGTH + 1),
        ))
        data = manager.normalize()
        assert len(data['culprit']) == MAX_CULPRIT_LENGTH

    def test_long_message(self):
        manager = EventManager(self.make_event(
            message='x' * (settings.SENTRY_MAX_MESSAGE_LENGTH + 1),
        ))
        data = manager.normalize()
        assert len(data['message']) == settings.SENTRY_MAX_MESSAGE_LENGTH

    def test_default_version(self):
        manager = EventManager(self.make_event())
        data = manager.normalize()
        assert data['version'] == '5'

    def test_explicit_version(self):
        manager = EventManager(self.make_event(), '6')
        data = manager.normalize()
        assert data['version'] == '6'


class GetHashesFromEventTest(TestCase):
    @patch('sentry.interfaces.stacktrace.Stacktrace.compute_hashes')
    @patch('sentry.interfaces.http.Http.compute_hashes')
    def test_stacktrace_wins_over_http(self, http_comp_hash, stack_comp_hash):
        # this was a regression, and a very important one
        http_comp_hash.return_value = [['baz']]
        stack_comp_hash.return_value = [['foo', 'bar']]
        event = Event(
            data={
                'sentry.interfaces.Stacktrace': {
                    'frames': [{
                        'lineno': 1,
                        'filename': 'foo.py',
                    }],
                },
                'sentry.interfaces.Http': {
                    'url': 'http://example.com'
                },
            },
            platform='python',
            message='Foo bar',
        )
        checksums = get_hashes_for_event(event)
        assert len(checksums) == 1
        checksum = checksums[0]
        stack_comp_hash.assert_called_once_with('python')
        assert not http_comp_hash.called
        assert checksum == '3858f62230ac3c915f300c664312c63f'

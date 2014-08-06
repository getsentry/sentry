# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from mock import patch

from sentry.event_manager import EventManager, get_hashes_for_event
from sentry.models import Event, Group, Project, EventMapping
from sentry.testutils import TestCase


class EventManagerTest(TestCase):
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

    def test_invalid_project(self):
        manager = EventManager(self.make_event())
        with self.assertRaises(Project.DoesNotExist):
            event = manager.save(2)

    @patch('sentry.manager.GroupManager.add_tags')
    def test_tags_as_list(self, add_tags):
        manager = EventManager(self.make_event(tags=[('foo', 'bar')]))
        data = manager.normalize()

        assert data['tags'] == [('foo', 'bar')]

    @patch('sentry.manager.GroupManager.add_tags')
    def test_tags_as_dict(self, add_tags):
        manager = EventManager(self.make_event(tags={'foo': 'bar'}))
        data = manager.normalize()

        assert data['tags'] == [('foo', 'bar')]

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
        event2 = manager.save(1)

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen.replace(microsecond=0) == event.datetime.replace(microsecond=0)
        assert group.message == event2.message


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
            message='Foo bar',
        )
        checksums = get_hashes_for_event(event)
        assert len(checksums) == 1
        checksum = checksums[0]
        stack_comp_hash.assert_called_once_with()
        assert not http_comp_hash.called
        assert checksum == '3858f62230ac3c915f300c664312c63f'

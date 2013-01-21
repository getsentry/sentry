# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import mock
import pytest

from django.utils import timezone
from sentry.interfaces import Interface
from sentry.manager import get_checksum_from_event
from sentry.models import Event, Group, Project, MessageCountByMinute, ProjectCountByMinute, \
  SearchDocument
from sentry.utils.db import has_trending  # NOQA
from sentry.testutils import TestCase


class DummyInterface(Interface):
    def __init__(self, baz):
        self.baz = baz


class SentryManagerTest(TestCase):
    @mock.patch('sentry.models.SearchDocument.objects.index')
    def test_broken_search_index(self, index):
        index.side_effect = Exception()

        event = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)

    @mock.patch('sentry.signals.regression_signal.send')
    def test_broken_regression_signal(self, send):
        send.side_effect = Exception()

        event = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)

    def test_invalid_project(self):
        self.assertRaises(Project.DoesNotExist, Group.objects.from_kwargs, 2, message='foo')

    def test_valid_only_message(self):
        event = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(event.group.last_seen, event.datetime)
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)

    def test_records_users_seen(self):
        # TODO: we could lower the level of this test by just testing our signal receiver's logic
        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'foo@example.com',
            },
        })
        group = Group.objects.get(id=event.group_id)
        assert group.users_seen == 1

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'foo@example.com',
            },
        })
        group = Group.objects.get(id=event.group_id)
        assert group.users_seen == 1

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'bar@example.com',
            },
        })
        group = Group.objects.get(id=event.group_id)
        assert group.users_seen == 2

    def test_valid_timestamp_without_tz(self):
        # TODO: this doesnt error, but it will throw a warning. What should we do?
        with self.Settings(USE_TZ=True):
            date = datetime.datetime.utcnow()
            event = Group.objects.from_kwargs(1, message='foo', timestamp=date)
            self.assertEquals(event.message, 'foo')
            self.assertEquals(event.project_id, 1)
            self.assertEquals(event.datetime, date.replace(tzinfo=timezone.utc))

    def test_url_filter(self):
        event = Group.objects.from_kwargs(1, message='foo')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='url').count(), 0)

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
            }
        })
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='url').count(), 1)
        res = group.messagefiltervalue_set.filter(key='url').get()
        self.assertEquals(res.value, 'http://example.com')
        self.assertEquals(res.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
            }
        })
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='url').count(), 1)
        res = group.messagefiltervalue_set.filter(key='url').get()
        self.assertEquals(res.value, 'http://example.com')
        self.assertEquals(res.times_seen, 2)

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.Http': {
                'url': 'http://example.com/2',
            }
        })
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='url').count(), 2)
        results = list(group.messagefiltervalue_set.filter(key='url').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'http://example.com')
        self.assertEquals(res.times_seen, 2)
        res = results[1]
        self.assertEquals(res.value, 'http://example.com/2')
        self.assertEquals(res.times_seen, 1)

    def test_server_name_filter(self):
        event = Group.objects.from_kwargs(1, message='foo')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='server_name').count(), 0)

        event = Group.objects.from_kwargs(1, message='foo', server_name='foo')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='server_name').count(), 1)
        res = group.messagefiltervalue_set.filter(key='server_name').get()
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo', server_name='foo')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='server_name').count(), 1)
        res = group.messagefiltervalue_set.filter(key='server_name').get()
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 2)

        event = Group.objects.from_kwargs(1, message='foo', server_name='bar')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='server_name').count(), 2)
        results = list(group.messagefiltervalue_set.filter(key='server_name').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 2)
        res = results[1]
        self.assertEquals(res.value, 'bar')
        self.assertEquals(res.times_seen, 1)

    @mock.patch('sentry.manager.send_group_processors', mock.Mock())
    @mock.patch('sentry.manager.GroupManager.add_tags')
    def test_tags_as_list(self, add_tags):
        event = Group.objects.from_kwargs(1, message='foo', tags=[('foo', 'bar')])
        group = event.group
        add_tags.assert_called_once_with(group, [('foo', 'bar'), ('logger', 'root'), ('level', 'error')])

    @mock.patch('sentry.manager.send_group_processors', mock.Mock())
    @mock.patch('sentry.manager.GroupManager.add_tags')
    def test_tags_as_dict(self, add_tags):
        event = Group.objects.from_kwargs(1, message='foo', tags={'foo': 'bar'})
        group = event.group
        add_tags.assert_called_once_with(group, [('foo', 'bar'), ('logger', 'root'), ('level', 'error')])

    @mock.patch('sentry.manager.send_group_processors', mock.Mock())
    def test_platform_is_saved(self):
        event = Group.objects.from_kwargs(1, message='foo', platform='python')
        group = event.group
        self.assertEquals(group.platform, 'python')
        self.assertEquals(event.platform, 'python')

    def test_dupe_message_id(self):
        event = Group.objects.from_kwargs(1, event_id=1, message='foo')
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)
        self.assertEquals(Event.objects.count(), 1)

        # ensure that calling it again doesnt raise a db error
        Group.objects.from_kwargs(1, event_id=1, message='foo')
        self.assertEquals(Event.objects.count(), 1)

    def test_does_update_messagecountbyminute(self):
        event = Group.objects.from_kwargs(1, message='foo')
        inst = MessageCountByMinute.objects.filter(group=event.group)
        self.assertTrue(inst.exists())
        inst = inst.get()
        self.assertEquals(inst.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo')
        inst = MessageCountByMinute.objects.get(group=event.group)
        self.assertEquals(inst.times_seen, 2)

    def test_does_update_projectcountbyminute(self):
        event = Group.objects.from_kwargs(1, message='foo')
        inst = ProjectCountByMinute.objects.filter(project=event.project)
        self.assertTrue(inst.exists())
        inst = inst.get()
        self.assertEquals(inst.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo')
        inst = ProjectCountByMinute.objects.get(project=event.project)
        self.assertEquals(inst.times_seen, 2)

    def test_updates_group(self):
        Group.objects.from_kwargs(1, message='foo', checksum='a' * 32)
        event = Group.objects.from_kwargs(1, message='foo bar', checksum='a' * 32)

        group = Group.objects.get(pk=event.group_id)

        self.assertEquals(group.times_seen, 2)
        self.assertEquals(group.last_seen.replace(microsecond=0), event.datetime.replace(microsecond=0))
        self.assertEquals(group.message, 'foo bar')

    @mock.patch('sentry.manager.maybe_delay')
    def test_scrapes_javascript_source(self, maybe_delay):
        from sentry.tasks.fetch_source import fetch_javascript_source
        with self.Settings(SENTRY_SCRAPE_JAVASCRIPT_CONTEXT=True):
            event = Group.objects.from_kwargs(1, message='hello', platform='javascript')

            maybe_delay.assert_any_call(fetch_javascript_source, event)

    def test_add_tags(self):
        event = Group.objects.from_kwargs(1, message='rrr')
        group = event.group
        Group.objects.add_tags(group, tags=(('foo', 'bar'), ('foo', 'baz'), ('biz', 'boz')))

        self.assertEquals(group.messagefiltervalue_set.filter(key='foo').count(), 2)
        results = list(group.messagefiltervalue_set.filter(key='foo').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'bar')
        self.assertEquals(res.times_seen, 1)
        res = results[1]
        self.assertEquals(res.value, 'baz')
        self.assertEquals(res.times_seen, 1)

        self.assertEquals(group.messagefiltervalue_set.filter(key='biz').count(), 1)
        results = list(group.messagefiltervalue_set.filter(key='biz').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'boz')
        self.assertEquals(res.times_seen, 1)


class SearchManagerTest(TestCase):
    def test_search(self):
        project = Project.objects.all()[0]
        group = Group.objects.create(project=project, message='foo', checksum='a' * 32)
        doc = SearchDocument.objects.create(
            project=project,
            group=group,
            status=group.status,
            total_events=1,
            date_added=group.first_seen,
            date_changed=group.last_seen,
        )
        doc.token_set.create(
            field='text',
            token='foo',
        )

        results = list(SearchDocument.objects.search(project, query='foo'))
        self.assertEquals(len(results), 1)
        # This uses a raw query set so we have to check the id
        self.assertEquals(results[0].id, doc.id)


@pytest.mark.skipif('not has_trending()')
class TrendsTest(TestCase):
    def test_accelerated_works_at_all(self):
        now = timezone.now() - datetime.timedelta(minutes=5)
        project = Project.objects.all()[0]
        group = Group.objects.create(status=0, project=project, message='foo', checksum='a' * 32)
        group2 = Group.objects.create(status=0, project=project, message='foo', checksum='b' * 32)
        MessageCountByMinute.objects.create(project=project, group=group, date=now, times_seen=50)
        MessageCountByMinute.objects.create(project=project, group=group2, date=now, times_seen=40)
        base_qs = Group.objects.filter(
            status=0,
        )

        results = list(Group.objects.get_accelerated([project.id], base_qs)[:25])
        self.assertEquals(results, [group, group2])


class GetChecksumFromEventTest(TestCase):
    @mock.patch('sentry.interfaces.Stacktrace.get_composite_hash')
    @mock.patch('sentry.interfaces.Http.get_composite_hash')
    def test_stacktrace_wins_over_http(self, http_comp_hash, stack_comp_hash):
        # this was a regression, and a very important one
        http_comp_hash.return_value = ['baz']
        stack_comp_hash.return_value = ['foo', 'bar']
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
        checksum = get_checksum_from_event(event)
        stack_comp_hash.assert_called_once_with(interfaces=event.interfaces)
        assert not http_comp_hash.called
        assert checksum == '3858f62230ac3c915f300c664312c63f'

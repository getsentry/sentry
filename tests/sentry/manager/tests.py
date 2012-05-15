# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import mock

from sentry.interfaces import Interface
from sentry.models import Event, Group, Project, MessageCountByMinute, ProjectCountByMinute, \
  FilterValue, MessageFilterValue

from tests.base import TestCase


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

    # TODO: determine why we need this test
    # def test_valid_timestamp_with_tz(self):
    #     with self.Settings(USE_TZ=True):
    #         date = datetime.datetime.utcnow().replace(tzinfo=pytz.utc)
    #         event = Group.objects.from_kwargs(1, message='foo', timestamp=date)
    #         self.assertEquals(event.message, 'foo')
    #         self.assertEquals(event.project_id, 1)
    #         self.assertEquals(event.datetime, date)

    def test_valid_timestamp_without_tz(self):
        # TODO: this doesnt error, but it will throw a warning. What should we do?
        with self.Settings(USE_TZ=True):
            date = datetime.datetime.utcnow()
            event = Group.objects.from_kwargs(1, message='foo', timestamp=date)
            self.assertEquals(event.message, 'foo')
            self.assertEquals(event.project_id, 1)
            self.assertEquals(event.datetime, date)

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

    def test_site_filter(self):
        event = Group.objects.from_kwargs(1, message='foo')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='site').count(), 0)

        event = Group.objects.from_kwargs(1, message='foo', site='foo')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='site').count(), 1)
        res = group.messagefiltervalue_set.filter(key='site').get()
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 1)

        event = Group.objects.from_kwargs(1, message='foo', site='foo')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='site').count(), 1)
        res = group.messagefiltervalue_set.filter(key='site').get()
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 2)

        event = Group.objects.from_kwargs(1, message='foo', site='bar')
        group = event.group
        self.assertEquals(group.messagefiltervalue_set.filter(key='site').count(), 2)
        results = list(group.messagefiltervalue_set.filter(key='site').order_by('id'))
        res = results[0]
        self.assertEquals(res.value, 'foo')
        self.assertEquals(res.times_seen, 2)
        res = results[1]
        self.assertEquals(res.value, 'bar')
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
        event = Group.objects.from_kwargs(1, message='foo', checksum='a' * 32)

        group = Group.objects.get(pk=event.group_id)

        self.assertEquals(group.times_seen, 2)
        self.assertEquals(group.last_seen, event.datetime)

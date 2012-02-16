# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import mock

from sentry.exceptions import InvalidInterface, InvalidData
from sentry.interfaces import Interface
from sentry.models import Group, Project

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

    def test_invalid_interface_name(self):
        self.assertRaises(InvalidInterface, Group.objects.from_kwargs, 1, message='foo', data={
            'foo': 'bar',
        })

    def test_invalid_interface_import_path(self):
        self.assertRaises(InvalidInterface, Group.objects.from_kwargs, 1, message='foo', data={
            'sentry.interfaces.Exception2': 'bar',
        })

    def test_invalid_interface_args(self):
        self.assertRaises(InvalidData, Group.objects.from_kwargs, 1, message='foo', data={
            'tests.manager.tests.DummyInterface': {'foo': 'bar'}
        })

    def test_missing_required_args(self):
        self.assertRaises(InvalidData, Group.objects.from_kwargs, 1)

    def test_valid_only_message(self):
        event = Group.objects.from_kwargs(1, message='foo')
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

    def test_legacy_data(self):
        result = Group.objects.convert_legacy_kwargs({'timestamp': '1234'})
        self.assertEquals(result['timestamp'], '1234')

        result = Group.objects.convert_legacy_kwargs({'message_id': '1234'})
        self.assertEquals(result['event_id'], '1234')

        result = Group.objects.convert_legacy_kwargs({'message': 'hello', 'class_name': 'ValueError'})
        self.assertEquals(result['message'], 'ValueError: hello')

        result = Group.objects.convert_legacy_kwargs({'view': 'foo.bar'})
        self.assertEquals(result['culprit'], 'foo.bar')

        result = Group.objects.convert_legacy_kwargs({'data': {
            'url': 'http://foo.com',
            'META': {
                'REQUEST_METHOD': 'POST',
                'QUERY_STRING': 'foo=bar'
            }
        }})
        self.assertTrue('sentry.interfaces.Http' in result)
        http = result['sentry.interfaces.Http']
        self.assertEquals(http['url'], 'http://foo.com')
        self.assertEquals(http['query_string'], 'foo=bar')
        self.assertEquals(http['method'], 'POST')
        self.assertEquals(http['data'], {})

        result = Group.objects.convert_legacy_kwargs({'data': {
            '__sentry__': {
                'exception': ('TypeError', ('hello world', 1, 3, 'foo')),
            }
        }})
        self.assertTrue('sentry.interfaces.Exception' in result)
        exc = result['sentry.interfaces.Exception']
        self.assertEquals(exc['type'], 'TypeError')
        self.assertEquals(exc['value'], 'hello world 1 3 foo')

        result = Group.objects.convert_legacy_kwargs({'data': {
            '__sentry__': {
                'frames': [
                    {
                        'filename': 'foo.py',
                        'function': 'hello_world',
                        'vars': {},
                        'pre_context': ['before i did something'],
                        'context_line': 'i did something',
                        'post_context': ['after i did something'],
                        'lineno': 15,
                    },
                ],
            }
        }})
        self.assertTrue('sentry.interfaces.Stacktrace' in result)
        stack = result['sentry.interfaces.Stacktrace']
        self.assertEquals(len(stack['frames']), 1)
        frame = stack['frames'][0]
        self.assertEquals(frame['filename'], 'foo.py')
        self.assertEquals(frame['function'], 'hello_world')

        result = Group.objects.convert_legacy_kwargs({'data': {
            '__sentry__': {
                'user': {
                    'is_authenticated': True,
                    'id': 1,
                },
            }
        }})
        self.assertTrue('sentry.interfaces.User' in result)
        user = result['sentry.interfaces.User']
        self.assertTrue('is_authenticated' in user)
        self.assertEquals(user['is_authenticated'], True)
        self.assertTrue('id' in user)
        self.assertEquals(user['id'], 1)

        result = Group.objects.convert_legacy_kwargs({'data': {
            '__sentry__': {
                'template': [
                    "foo\nbar\nbaz\nbiz\nbin",
                    5,
                    3,
                    'foo.html',
                ],
            }
        }})
        self.assertTrue('sentry.interfaces.Template' in result)
        user = result['sentry.interfaces.Template']
        # 'post_context': [(2, 'bar\n'), (3, 'baz\n'), (4, 'biz\n')], 'pre_context': [(0, '')], 'lineno': 1, 'context_line': (1, 'foo\n'), 'filename': 'foo.html'}

        self.assertTrue('pre_context' in user)
        self.assertEquals(user['pre_context'], [(0, ''), (1, 'foo\n')])
        self.assertTrue('post_context' in user)
        self.assertEquals(user['post_context'], [(3, 'baz\n'), (4, 'biz\n'), (5, 'bin')])
        self.assertTrue('lineno' in user)
        self.assertEquals(user['lineno'], 2)
        self.assertTrue('context_line' in user)
        self.assertEquals(user['context_line'], 'bar\n')

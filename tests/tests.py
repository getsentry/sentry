# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import getpass
import logging
import pytz

from django.core import mail

from sentry.conf import settings
from sentry.exceptions import InvalidInterface, InvalidData
from sentry.interfaces import Interface
from sentry.models import Group, Project

from tests.base import TestCase

# Configure our test handler

logger = logging.getLogger(__name__)


class SentryMailTest(TestCase):
    fixtures = ['tests/fixtures/mail.json']

    def setUp(self):
        settings.ADMINS = ('%s@localhost' % getpass.getuser(),)

    def test_mail_admins(self):
        group = Group.objects.get()
        self.assertEquals(len(mail.outbox), 0)
        group.mail_admins(fail_silently=False)
        self.assertEquals(len(mail.outbox), 1)

        # TODO: needs a new fixture
        # out = mail.outbox[0]

        # self.assertTrue('Traceback (most recent call last):' in out.body)
        # self.assertTrue("COOKIES:{'commenter_name': 'admin'," in out.body, out.body)
        # self.assertEquals(out.subject, '[Django] Error (EXTERNAL IP): /group/1')

    # def test_mail_on_creation(self):
    #     settings.MAIL = True

    #     self.assertEquals(len(mail.outbox), 0)
    #     self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
    #     self.assertEquals(len(mail.outbox), 1)
    #     self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
    #     self.assertEquals(len(mail.outbox), 1)

    #     out = mail.outbox[0]

    #     self.assertTrue('Traceback (most recent call last):' in out.body)
    #     self.assertTrue("<Request" in out.body)
    #     self.assertEquals(out.subject, '[example.com] [Django] Error (EXTERNAL IP): /trigger-500')

    # def test_mail_on_duplication(self):
    #     settings.MAIL = True

    #     self.assertEquals(len(mail.outbox), 0)
    #     self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
    #     self.assertEquals(len(mail.outbox), 1)
    #     self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
    #     self.assertEquals(len(mail.outbox), 1)
    #     # XXX: why wont this work
    #     # group = Group.objects.update(status=1)
    #     group = Group.objects.all().order_by('-id')[0]
    #     group.status = 1
    #     group.save()
    #     self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
    #     self.assertEquals(len(mail.outbox), 2)
    #     self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
    #     self.assertEquals(len(mail.outbox), 2)

    #     out = mail.outbox[1]

    #     self.assertTrue('Traceback (most recent call last):' in out.body)
    #     self.assertTrue("<Request" in out.body)
    #     self.assertEquals(out.subject, '[example.com] [Django] Error (EXTERNAL IP): /trigger-500')

    def test_url_prefix(self):
        settings.URL_PREFIX = 'http://example.com'

        group = Group.objects.get()
        group.mail_admins(fail_silently=False)

        out = mail.outbox[0]

        self.assertTrue('http://example.com/group/2' in out.body, out.body)


class DummyInterface(Interface):
    def __init__(self, baz):
        self.baz = baz


class SentryManagerTest(TestCase):
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
            'tests.tests.DummyInterface': {'foo': 'bar'}
        })

    def test_missing_required_args(self):
        self.assertRaises(InvalidData, Group.objects.from_kwargs, 1)

    def test_valid_only_message(self):
        event = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(event.message, 'foo')
        self.assertEquals(event.project_id, 1)

    def test_valid_timestamp_with_tz(self):
        with self.Settings(USE_TZ=True):
            date = datetime.datetime.now().replace(tzinfo=pytz.utc)
            event = Group.objects.from_kwargs(1, message='foo', timestamp=date)
            self.assertEquals(event.message, 'foo')
            self.assertEquals(event.project_id, 1)
            self.assertEquals(event.datetime, date)

    def test_valid_timestamp_without_tz(self):
        # TODO: this doesnt error, but it will throw a warning. What should we do?
        with self.Settings(USE_TZ=True):
            date = datetime.datetime.now()
            event = Group.objects.from_kwargs(1, message='foo', timestamp=date)
            self.assertEquals(event.message, 'foo')
            self.assertEquals(event.project_id, 1)
            self.assertEquals(event.datetime, date)

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

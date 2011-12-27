# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime
import getpass
import logging
import os.path

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.core import mail
from django.core.urlresolvers import reverse

from sentry.conf import settings
from sentry.exceptions import InvalidInterface, InvalidData
from sentry.interfaces import Interface
from sentry.models import Event, Group, MessageCountByMinute, \
  MessageFilterValue, Project, ProjectMember
from sentry.web.helpers import get_login_url

from tests.testcases import TestCase
from tests.utils import conditional_on_module, Settings

# class NullHandler(logging.Handler):
#     def emit(self, record):
#         pass
#
# # Configure our "oh shit" handler, so that we dont output a bunch of unused
# # information to stderr
#
# logger = logging.getLogger('sentry.error')
# logger.addHandler(NullHandler())

# Configure our test handler

logger = logging.getLogger(__name__)

class SentryViewsTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()

    def test_auth(self):
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/login.html')

        resp = self.client.post(reverse('sentry-login'), {
            'username': 'admin',
            'password': 'admin',
        }, follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateNotUsed(resp, 'sentry/login.html')

    def test_get_login_url(self):
        with Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

        with Settings(LOGIN_URL=reverse('sentry-fake-login')):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-fake-login'))

        # should still be cached
        with Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(False)
            self.assertEquals(url, reverse('sentry-fake-login'))

        with Settings(SENTRY_LOGIN_URL=None):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

    def test_dashboard(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateNotUsed(resp, 'sentry/dashboard.html')

        # requires two projects to show dashboard
        p = Project.objects.create(name='foo')
        ProjectMember.objects.create(project=p, user=self.user)
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')

    def test_index(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry', kwargs={'project_id': 1}) + '?sort=freq', follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')
        self.assertEquals(len(resp.context['event_list']), 4)
        group = resp.context['event_list'][0]
        self.assertEquals(group.times_seen, 7)
        self.assertEquals(group.message, "'tuple' object has no attribute 'args'")

    def test_group_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group', kwargs={'group_id': 2}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_event_list(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-events', args=[2]), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event_list.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_message_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-event', kwargs={'group_id': 2, 'event_id': 4}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

class SentryRemoteTest(TestCase):

    def setUp(self):
        settings.REMOTE_URL = ['http://localhost:8000%s' % reverse('sentry-store')]
        logger = logging.getLogger('sentry')
        for h in logger.handlers:
            logger.removeHandler(h)
        logger.addHandler(logging.StreamHandler())

    def tearDown(self):
        settings.REMOTE_URL = None

    def test_no_key(self):
        resp = self.client.post(reverse('sentry-store'))
        self.assertEquals(resp.status_code, 401)

    # def test_no_data(self):
    #     resp = self.client.post(reverse('sentry-store'), {
    #         'key': settings.KEY,
    #     })
    #     self.assertEquals(resp.status_code, 400)

    # def test_bad_data(self):
    #     resp = self.client.post(reverse('sentry-store'), {
    #         'key': settings.KEY,
    #         'data': 'hello world',
    #     })
    #     self.assertEquals(resp.status_code, 401)
        # self.assertEquals(resp.content, 'Bad data decoding request (TypeError, Incorrect padding)')

    def test_correct_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def test_unicode_keys(self):
        kwargs = {u'message': 'hello', u'server_name': 'not_dcramer.local', u'level': 40, u'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def test_timestamp(self):
        timestamp = datetime.datetime.now() - datetime.timedelta(hours=1)
        kwargs = {u'message': 'hello', 'timestamp': timestamp.strftime('%s.%f')}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.datetime, timestamp)
        group = instance.group
        self.assertEquals(group.first_seen, timestamp)
        self.assertEquals(group.last_seen, timestamp)

    def test_timestamp_as_iso(self):
        timestamp = datetime.datetime.now() - datetime.timedelta(hours=1)
        kwargs = {u'message': 'hello', 'timestamp': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f')}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.datetime, timestamp)
        group = instance.group
        self.assertEquals(group.first_seen, timestamp)
        self.assertEquals(group.last_seen, timestamp)

    def test_ungzipped_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Event.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    # def test_byte_sequence(self):
    #     """
    #     invalid byte sequence for encoding "UTF8": 0xedb7af
    #     """
    #     # TODO:
    #     # add 'site' to data in fixtures/bad_data.json, then assert it's set correctly below

    #     fname = os.path.join(os.path.dirname(__file__), 'fixtures/bad_data.json')
    #     data = open(fname).read()

    #     resp = self.client.post(reverse('sentry-store'), {
    #         'data': data,
    #         'key': settings.KEY,
    #     })

    #     self.assertEquals(resp.status_code, 200)

    #     self.assertEquals(Event.objects.count(), 1)

    #     instance = Event.objects.get()

    #     self.assertEquals(instance.message, 'DatabaseError: invalid byte sequence for encoding "UTF8": 0xeda4ac\nHINT:  This error can also happen if the byte sequence does not match the encoding expected by the server, which is controlled by "client_encoding".\n')
    #     self.assertEquals(instance.server_name, 'shilling.disqus.net')
    #     self.assertEquals(instance.level, 40)

    def test_signature(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}

        resp = self._postWithSignature(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Event.objects.get()

        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

class SentryFeedsTest(TestCase):
    fixtures = ['tests/fixtures/feeds.json']

    def test_message_feed(self):
        response = self.client.get(reverse('sentry-feed-messages'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>log messages</title>' in response.content)
        self.assertTrue('<link>http://testserver/1/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

    def test_summary_feed(self):
        response = self.client.get(reverse('sentry-feed-summaries'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>log summaries</title>' in response.content)
        self.assertTrue('<link>http://testserver/1/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>(1) exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

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

class SentryHelpersTest(TestCase):
    def test_get_db_engine(self):
        from sentry.utils import get_db_engine
        _databases = getattr(django_settings, 'DATABASES', {}).copy()
        _engine = django_settings.DATABASE_ENGINE

        django_settings.DATABASE_ENGINE = ''
        django_settings.DATABASES['default'] = {'ENGINE': 'blah.sqlite3'}

        self.assertEquals(get_db_engine(), 'sqlite3')

        django_settings.DATABASE_ENGINE = 'mysql'

        self.assertEquals(get_db_engine(), 'sqlite3')

        django_settings.DATABASES['default'] = {'ENGINE': 'blah.mysql'}

        self.assertEquals(get_db_engine(), 'mysql')

        django_settings.DATABASES = _databases
        django_settings.DATABASE_ENGINE = _engine

class SentryCleanupTest(TestCase):
    fixtures = ['tests/fixtures/cleanup.json']

    def test_simple(self):
        from sentry.scripts.runner import cleanup

        cleanup(days=1)

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_logger(self):
        from sentry.scripts.runner import cleanup

        cleanup(days=1, logger='sentry')

        self.assertEquals(Event.objects.count(), 8)
        for message in Event.objects.all():
            self.assertNotEquals(message.logger, 'sentry')
        self.assertEquals(Group.objects.count(), 3)
        for message in Group.objects.all():
            self.assertNotEquals(message.logger, 'sentry')

        cleanup(days=1, logger='awesome')

        self.assertEquals(Event.objects.count(), 4)
        for message in Event.objects.all():
            self.assertNotEquals(message.logger, 'awesome')
        self.assertEquals(Group.objects.count(), 2)
        for message in Group.objects.all():
            self.assertNotEquals(message.logger, 'awesome')

        cleanup(days=1, logger='root')

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_server_name(self):
        from sentry.scripts.runner import cleanup

        cleanup(days=1, server='dcramer.local')

        self.assertEquals(Event.objects.count(), 2)
        for message in Event.objects.all():
            self.assertNotEquals(message.server_name, 'dcramer.local')
        self.assertEquals(Group.objects.count(), 1)

        cleanup(days=1, server='node.local')

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_level(self):
        from sentry.scripts.runner import cleanup

        cleanup(days=1, level=logging.ERROR)

        self.assertEquals(Event.objects.count(), 1)
        for message in Event.objects.all():
            self.assertNotEquals(message.level, logging.ERROR)
        self.assertEquals(Group.objects.count(), 1)

        cleanup(days=1, level=logging.DEBUG)

        self.assertEquals(Event.objects.count(), 0)
        self.assertEquals(Group.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

class SentrySearchTest(TestCase):
    def test_checksum_query(self):
        checksum = 'a'*32
        g = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )

        with Settings(SENTRY_PUBLIC=True):
            response = self.client.get(reverse('sentry-search', kwargs={'project_id': 1}), {'q': '%s$%s' % (checksum, checksum)})
            self.assertEquals(response.status_code, 302)
            self.assertEquals(response['Location'], 'http://testserver%s' % (g.get_absolute_url(),))

    def test_dupe_checksum(self):
        checksum = 'a'*32
        g1 = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )
        g2 = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='b',
            checksum=checksum,
            message='hi',
        )

        with Settings(SENTRY_PUBLIC=True):
            response = self.client.get(reverse('sentry-search', kwargs={'project_id': 1}), {'q': '%s$%s' % (checksum, checksum)})
            self.assertEquals(response.status_code, 200)
            self.assertTemplateUsed(response, 'sentry/search.html')
            context = response.context
            self.assertTrue('event_list' in context)
            self.assertEquals(len(context['event_list']), 2)
            self.assertTrue(g1 in context['event_list'])
            self.assertTrue(g2 in context['event_list'])

class DummyInterface(Interface):
    def __init__(self, baz):
        self.baz = baz

class SentryPluginTest(TestCase):
    def test_registration(self):
        from sentry.plugins import GroupActionProvider
        self.assertEquals(len(GroupActionProvider.plugins), 4)

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
        group = Group.objects.from_kwargs(1, message='foo')
        self.assertEquals(group.message, 'foo')
        self.assertEquals(group.project_id, 1)

    def test_legacy_data(self):
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
                'exception': ('TypeError', ('hello world',)),
            }
        }})
        self.assertTrue('sentry.interfaces.Exception' in result)
        exc = result['sentry.interfaces.Exception']
        self.assertEquals(exc['type'], 'TypeError')
        self.assertEquals(exc['value'], 'hello world')

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

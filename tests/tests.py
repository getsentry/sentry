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
from sentry.models import Message, GroupedMessage, MessageCountByMinute, \
                          FilterValue, MessageFilterValue
from sentry.web.helpers import get_login_url

from tests.models import TestModel, DuplicateKeyModel
from tests.testcases import TestCase, TransactionTestCase
from tests.utils import TestServerThread, conditional_on_module, Settings

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
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')

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
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')

    def test_index(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry', kwargs={'project_id': 1}) + '?sort=freq', follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/index.html')
        self.assertEquals(len(resp.context['message_list']), 4)
        group = resp.context['message_list'][0]
        self.assertEquals(group.times_seen, 7)
        self.assertEquals(group.class_name, 'AttributeError')

    def test_group_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group', kwargs={'group_id': 2}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/group/details.html')
        self.assertTrue('group' in resp.context)
        group = GroupedMessage.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_message_list(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-messages', args=[2]), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/group/message_list.html')
        self.assertTrue('group' in resp.context)
        group = GroupedMessage.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_message_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-message', kwargs={'group_id': 2, 'message_id': 4}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/group/message.html')
        self.assertTrue('group' in resp.context)
        group = GroupedMessage.objects.get(pk=2)
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
        self.assertEquals(resp.status_code, 403)

    def test_no_data(self):
        resp = self.client.post(reverse('sentry-store'), {
            'key': settings.KEY,
        })
        self.assertEquals(resp.status_code, 400)

    def test_bad_data(self):
        resp = self.client.post(reverse('sentry-store'), {
            'key': settings.KEY,
            'data': 'hello world',
        })
        self.assertEquals(resp.status_code, 403)
        self.assertEquals(resp.content, 'Bad data decoding request (TypeError, Incorrect padding)')

    def test_correct_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Message.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def test_unicode_keys(self):
        kwargs = {u'message': 'hello', u'server_name': 'not_dcramer.local', u'level': 40, u'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Message.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def test_timestamp(self):
        timestamp = datetime.datetime.now() - datetime.timedelta(hours=1)
        kwargs = {u'message': 'hello', 'timestamp': timestamp.strftime('%s.%f')}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Message.objects.get()
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
        instance = Message.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.datetime, timestamp)
        group = instance.group
        self.assertEquals(group.first_seen, timestamp)
        self.assertEquals(group.last_seen, timestamp)

    def test_ungzipped_data(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Message.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    def test_byte_sequence(self):
        """
        invalid byte sequence for encoding "UTF8": 0xedb7af
        """
        # TODO:
        # add 'site' to data in fixtures/bad_data.json, then assert it's set correctly below

        fname = os.path.join(os.path.dirname(__file__), 'fixtures/bad_data.json')
        data = open(fname).read()

        resp = self.client.post(reverse('sentry-store'), {
            'data': data,
            'key': settings.KEY,
        })

        self.assertEquals(resp.status_code, 200)

        self.assertEquals(Message.objects.count(), 1)

        instance = Message.objects.get()

        self.assertEquals(instance.message, 'invalid byte sequence for encoding "UTF8": 0xeda4ac\nHINT:  This error can also happen if the byte sequence does not match the encoding expected by the server, which is controlled by "client_encoding".\n')
        self.assertEquals(instance.server_name, 'shilling.disqus.net')
        self.assertEquals(instance.level, 40)
        self.assertTrue(instance.data['__sentry__']['exc'])

    def test_legacy_auth(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}

        resp = self._postWithKey(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Message.objects.get()

        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    def test_signature(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}

        resp = self._postWithSignature(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Message.objects.get()

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
        self.assertTrue('<title>TypeError: exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

    def test_summary_feed(self):
        response = self.client.get(reverse('sentry-feed-summaries'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>log summaries</title>' in response.content)
        self.assertTrue('<link>http://testserver/1/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>(1) TypeError: exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

class SentryMailTest(TestCase):
    fixtures = ['tests/fixtures/mail.json']

    def setUp(self):
        settings.ADMINS = ('%s@localhost' % getpass.getuser(),)

    def test_mail_admins(self):
        group = GroupedMessage.objects.get()
        self.assertEquals(len(mail.outbox), 0)
        group.mail_admins(fail_silently=False)
        self.assertEquals(len(mail.outbox), 1)

        out = mail.outbox[0]

        self.assertTrue('Traceback (most recent call last):' in out.body)
        self.assertTrue("COOKIES:{'commenter_name': 'admin'," in out.body, out.body)
        self.assertEquals(out.subject, '[Django] Error (EXTERNAL IP): /group/1')

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
    #     # group = GroupedMessage.objects.update(status=1)
    #     group = GroupedMessage.objects.all().order_by('-id')[0]
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

        group = GroupedMessage.objects.get()
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

        self.assertEquals(Message.objects.count(), 0)
        self.assertEquals(GroupedMessage.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_logger(self):
        from sentry.scripts.runner import cleanup

        cleanup(days=1, logger='sentry')

        self.assertEquals(Message.objects.count(), 8)
        for message in Message.objects.all():
            self.assertNotEquals(message.logger, 'sentry')
        self.assertEquals(GroupedMessage.objects.count(), 3)
        for message in GroupedMessage.objects.all():
            self.assertNotEquals(message.logger, 'sentry')

        cleanup(days=1, logger='awesome')

        self.assertEquals(Message.objects.count(), 4)
        for message in Message.objects.all():
            self.assertNotEquals(message.logger, 'awesome')
        self.assertEquals(GroupedMessage.objects.count(), 2)
        for message in GroupedMessage.objects.all():
            self.assertNotEquals(message.logger, 'awesome')

        cleanup(days=1, logger='root')

        self.assertEquals(Message.objects.count(), 0)
        self.assertEquals(GroupedMessage.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_server_name(self):
        from sentry.scripts.runner import cleanup

        cleanup(days=1, server='dcramer.local')

        self.assertEquals(Message.objects.count(), 2)
        for message in Message.objects.all():
            self.assertNotEquals(message.server_name, 'dcramer.local')
        self.assertEquals(GroupedMessage.objects.count(), 1)

        cleanup(days=1, server='node.local')

        self.assertEquals(Message.objects.count(), 0)
        self.assertEquals(GroupedMessage.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

    def test_level(self):
        from sentry.scripts.runner import cleanup

        cleanup(days=1, level=logging.ERROR)

        self.assertEquals(Message.objects.count(), 1)
        for message in Message.objects.all():
            self.assertNotEquals(message.level, logging.ERROR)
        self.assertEquals(GroupedMessage.objects.count(), 1)

        cleanup(days=1, level=logging.DEBUG)

        self.assertEquals(Message.objects.count(), 0)
        self.assertEquals(GroupedMessage.objects.count(), 0)
        self.assertEquals(MessageCountByMinute.objects.count(), 0)
        self.assertEquals(MessageFilterValue.objects.count(), 0)

class SentrySearchTest(TestCase):
    @conditional_on_module('haystack')
    def test_build_index(self):
        from sentry.web.views import get_search_query_set
        logger.error('test search error')

        qs = get_search_query_set('error')
        self.assertEquals(qs.count(), 1)
        self.assertEquals(qs[0:1][0].message, 'test search error')

# -*- coding: utf-8 -*-

from __future__ import absolute_import

import base64
import datetime
import getpass
import logging
import os.path
import socket
import time

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.core import mail
from django.core.urlresolvers import reverse
from django.core.signals import got_request_exception
from django.test import TestCase, TransactionTestCase
from django.template import TemplateSyntaxError
from django.utils.encoding import smart_unicode
from django.utils.functional import lazy

from sentry.client.base import SentryClient
from sentry.client.handlers import SentryHandler
from sentry.client.models import get_client
from sentry.conf import settings
from sentry.models import Message, GroupedMessage, MessageCountByMinute, \
                          FilterValue, MessageFilterValue
from sentry.utils import json, transform, get_signature, get_auth_header, \
                         MockDjangoRequest
from sentry.utils.compat import pickle
from sentry.web.views import get_login_url

from tests.models import TestModel, DuplicateKeyModel
from tests.utils import TestServerThread, conditional_on_module

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

logger = logging.getLogger('sentry.test')
logger.addHandler(SentryHandler())
logger.setLevel(logging.DEBUG)

class Settings(object):
    """
    Allows you to define settings that are required for this function to work.

    >>> with Settings(SENTRY_LOGIN_URL='foo'): #doctest: +SKIP
    >>>     print settings.SENTRY_LOGIN_URL #doctest: +SKIP
    """

    NotDefined = object()

    def __init__(self, **overrides):
        self.overrides = overrides
        self._orig = {}

    def __enter__(self):
        for k, v in self.overrides.iteritems():
            self._orig[k] = getattr(django_settings, k, self.NotDefined)
            setattr(django_settings, k, v)
            if k.startswith('SENTRY_'):
                setattr(settings, k.split('SENTRY_', 1)[1], v)

    def __exit__(self, exc_type, exc_value, traceback):
        for k, v in self._orig.iteritems():
            if v is self.NotDefined:
                delattr(django_settings, k)
                if k.startswith('SENTRY_'):
                    delattr(settings, k.split('SENTRY_', 1)[1])
            else:
                setattr(django_settings, k, v)
                if k.startswith('SENTRY_'):
                    setattr(settings, k.split('SENTRY_', 1)[1], v)

class BaseTestCase(TestCase):
    ## Helper methods for posting

    urls = 'tests.urls'

    def _postWithKey(self, data):
        resp = self.client.post(reverse('sentry-store'), {
            'data': base64.b64encode(pickle.dumps(transform(data))),
            'key': settings.KEY,
        })
        return resp

    def _postWithSignature(self, data):
        ts = time.time()
        message = base64.b64encode(json.dumps(transform(data)))
        sig = get_signature(message, ts)

        resp = self.client.post(reverse('sentry-store'), message,
            content_type='application/octet-stream',
            HTTP_AUTHORIZATION=get_auth_header(sig, ts, '_postWithSignature'),
        )
        return resp

class SentryTest(BaseTestCase):
    ## Fixture setup/teardown

    def setUp(self):
        self._middleware = django_settings.MIDDLEWARE_CLASSES
        self._handlers = None
        self._level = None
        self.logger = logging.getLogger('sentry')
        self.logger.addHandler(logging.StreamHandler())
        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()

    def tearDown(self):
        self.tearDownHandler()
        django_settings.MIDDLEWARE_CLASSES = self._middleware

    def setUpHandler(self):
        self.tearDownHandler()

        logger = logging.getLogger()
        self._handlers = logger.handlers
        self._level = logger.level

        for h in self._handlers:
            # TODO: fix this, for now, I don't care.
            logger.removeHandler(h)

        logger.setLevel(logging.DEBUG)
        sentry_handler = SentryHandler()
        logger.addHandler(sentry_handler)

    def tearDownHandler(self):
        if self._handlers is None:
            return

        logger = logging.getLogger()
        logger.removeHandler(logger.handlers[0])
        for h in self._handlers:
            logger.addHandler(h)

        logger.setLevel(self._level)
        self._handlers = None


    ## Tests

    def test_logger(self):
        logger = logging.getLogger()

        self.setUpHandler()

        logger.error('This is a test error')
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')

        logger.warning('This is a test warning')
        self.assertEquals(Message.objects.count(), 2)
        self.assertEquals(GroupedMessage.objects.count(), 2)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.WARNING)
        self.assertEquals(last.message, 'This is a test warning')

        logger.error('This is a test error')
        self.assertEquals(Message.objects.count(), 3)
        self.assertEquals(GroupedMessage.objects.count(), 2)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')

        logger = logging.getLogger('test')
        logger.info('This is a test info')
        self.assertEquals(Message.objects.count(), 4)
        self.assertEquals(GroupedMessage.objects.count(), 3)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'test')
        self.assertEquals(last.level, logging.INFO)
        self.assertEquals(last.message, 'This is a test info')

        logger.info('This is a test info with a url', extra=dict(url='http://example.com'))
        self.assertEquals(Message.objects.count(), 5)
        self.assertEquals(GroupedMessage.objects.count(), 4)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.url, 'http://example.com')

        try:
            raise ValueError('This is a test ValueError')
        except ValueError:
            logger.info('This is a test info with an exception', exc_info=True)

        self.assertEquals(Message.objects.count(), 6)
        self.assertEquals(GroupedMessage.objects.count(), 5)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.class_name, 'ValueError')
        self.assertEquals(last.message, 'This is a test info with an exception')
        self.assertTrue('__sentry__' in last.data)
        self.assertTrue('exception' in last.data['__sentry__'])
        self.assertTrue('frames' in last.data['__sentry__'])

        # test stacks
        logger.info('This is a test of stacks', extra={'stack': True})
        self.assertEquals(Message.objects.count(), 7)
        self.assertEquals(GroupedMessage.objects.count(), 6)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.view, 'tests.tests.test_logger')
        self.assertEquals(last.class_name, None)
        self.assertEquals(last.message, 'This is a test of stacks')
        self.assertTrue('__sentry__' in last.data)
        self.assertTrue('frames' in last.data['__sentry__'])

        # test no stacks
        logger.info('This is a test of no stacks', extra={'stack': False})
        self.assertEquals(Message.objects.count(), 8)
        self.assertEquals(GroupedMessage.objects.count(), 7)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.class_name, None)
        self.assertEquals(last.message, 'This is a test of no stacks')
        self.assertTrue('__sentry__' in last.data)
        self.assertFalse('frames' in last.data['__sentry__'])

        self.tearDownHandler()

    # def test_404_middleware(self):
    #     django_settings.MIDDLEWARE_CLASSES = django_settings.MIDDLEWARE_CLASSES + ('sentry.client.middleware.Sentry404CatchMiddleware',)
    #
    #     response = self.client.get("/404/this-page-does-not-exist", REMOTE_ADDR="127.0.0.1:8000")
    #     self.assertTemplateUsed(response, '404.html')
    #
    #     self.assertEquals(Message.objects.count(), 1)
    #     self.assertEquals(GroupedMessage.objects.count(), 1)
    #     last = Message.objects.get()
    #     self.assertEquals(last.logger, 'root')
    #     self.assertEquals(last.class_name, 'Http404')
    #     self.assertEquals(last.level, logging.ERROR)
    #     self.assertEquals(last.message, 'foo')

    def test_api(self):
        try:
            Message.objects.get(id=999999989)
        except Message.DoesNotExist, exc:
            message_id = get_client().create_from_exception()
            error = Message.objects.get(message_id=message_id)
            self.assertTrue('__sentry__' in error.data)
            self.assertTrue('exception' in error.data['__sentry__'])
        else:
            self.fail('Unable to create `Message` entry.')

        try:
            Message.objects.get(id=999999989)
        except Message.DoesNotExist, exc:
            message_id = get_client().create_from_exception()
            error = Message.objects.get(message_id=message_id)
            self.assertTrue('__sentry__' in error.data)
            self.assertTrue('exception' in error.data['__sentry__'])
        else:
            self.fail('Unable to create `Message` entry.')

        self.assertEquals(Message.objects.count(), 2)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))

        get_client().create_from_text('This is an error', level=logging.DEBUG)

        self.assertEquals(Message.objects.count(), 3)
        self.assertEquals(GroupedMessage.objects.count(), 2)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.DEBUG)
        self.assertEquals(last.message, 'This is an error')

    def test_alternate_database(self):
        settings.DATABASE_USING = 'default'

        try:
            Message.objects.get(id=999999979)
        except Message.DoesNotExist, exc:
            get_client().create_from_exception()
        else:
            self.fail('Unable to create `Message` entry.')

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))

        settings.DATABASE_USING = None

    def test_incorrect_unicode(self):
        self.setUpHandler()

        cnt = Message.objects.count()
        value = 'רונית מגן'

        message_id = get_client().create_from_text(value)
        error = Message.objects.get(message_id=message_id)

        self.assertEquals(Message.objects.count(), cnt+1)
        self.assertEquals(error.message, u'רונית מגן')

        logging.info(value)
        self.assertEquals(Message.objects.count(), cnt+2)

        x = TestModel.objects.create(data={'value': value})
        logging.warn(x)
        self.assertEquals(Message.objects.count(), cnt+3)

        try:
            raise SyntaxMessage(value)
        except Exception, exc:
            logging.exception(exc)
            logging.info('test', exc_info=True)
        self.assertEquals(Message.objects.count(), cnt+5)

        self.tearDownHandler()

    def test_correct_unicode(self):
        self.setUpHandler()

        cnt = Message.objects.count()
        value = 'רונית מגן'.decode('utf-8')

        message_id = get_client().create_from_text(value)
        error = Message.objects.get(message_id=message_id)

        self.assertEquals(Message.objects.count(), cnt+1)
        self.assertEquals(error.message, value)

        logging.info(value)
        self.assertEquals(Message.objects.count(), cnt+2)

        x = TestModel.objects.create(data={'value': value})
        logging.warn(x)
        self.assertEquals(Message.objects.count(), cnt+3)

        try:
            raise SyntaxMessage(value)
        except Exception, exc:
            logging.exception(exc)
            logging.info('test', exc_info=True)
        self.assertEquals(Message.objects.count(), cnt+5)

        self.tearDownHandler()

    def test_long_urls(self):
        # Fix: #6 solves URLs > 200 characters
        message_id = get_client().create_from_text('hello world', url='a'*210)
        error = Message.objects.get(message_id=message_id)

        self.assertEquals(error.url, 'a'*200)
        self.assertEquals(error.data['url'], 'a'*210)

    def test_thrashing(self):
        request = MockDjangoRequest()
        settings.THRASHING_LIMIT = 10
        settings.THRASHING_TIMEOUT = 60

        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()

        message_id = None
        for i in range(0, 10):
            this_message_id = get_client().create_from_text('test_thrashing', request=request)
            self.assertTrue(this_message_id is not None)
            self.assertTrue(hasattr(request, 'sentry'))
            self.assertTrue('thrashed' in request.sentry)
            self.assertFalse(request.sentry['thrashed'])
            self.assertNotEquals(this_message_id, message_id)
            message_id = this_message_id

        for i in range(0, 40):
            this_message_id = get_client().create_from_text('test_thrashing', request=request)
            self.assertTrue(hasattr(request, 'sentry'))
            self.assertTrue('thrashed' in request.sentry)
            self.assertTrue(request.sentry['thrashed'])
            self.assertEquals(this_message_id, message_id)

        self.assertEquals(Message.objects.count(), settings.THRASHING_LIMIT)

    def test_signals(self):
        try:
            Message.objects.get(id=999999999)
        except Message.DoesNotExist, exc:
            got_request_exception.send(sender=self.__class__, request=None)
        else:
            self.fail('Expected an exception.')

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))

    def test_signals_without_request(self):
        try:
            Message.objects.get(id=999999999)
        except Message.DoesNotExist, exc:
            got_request_exception.send(sender=self.__class__, request=None)
        else:
            self.fail('Expected an exception.')

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))

    def test_no_thrashing(self):
        prev = settings.THRASHING_LIMIT
        settings.THRASHING_LIMIT = 0

        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()

        for i in range(0, 50):
            get_client().create_from_text('hi')

        self.assertEquals(Message.objects.count(), 50)

        settings.THRASHING_LIMIT = prev

    def test_database_message(self):
        from django.db import connection

        try:
            cursor = connection.cursor()
            cursor.execute("select foo")
        except:
            got_request_exception.send(sender=self.__class__)

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)

    def test_integrity_message(self):
        DuplicateKeyModel.objects.create()
        try:
            DuplicateKeyModel.objects.create()
        except:
            got_request_exception.send(sender=self.__class__)
        else:
            self.fail('Excepted an IntegrityMessage to be raised.')

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)

    def test_view_exception(self):
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))

        self.assertEquals(GroupedMessage.objects.count(), 1)
        self.assertEquals(Message.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'Exception')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'view exception')
        self.assertEquals(last.view, 'tests.views.raise_exc')

    def test_user_info(self):
        user = User(username='admin', email='admin@example.com')
        user.set_password('admin')
        user.save()

        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))

        self.assertEquals(GroupedMessage.objects.count(), 1)
        self.assertEquals(Message.objects.count(), 1)
        last = Message.objects.get()
        self.assertTrue('user' in last.data['__sentry__'])
        user_info = last.data['__sentry__']['user']
        self.assertTrue('is_authenticated' in user_info)
        self.assertFalse(user_info['is_authenticated'])
        self.assertFalse('username' in user_info)
        self.assertFalse('email' in user_info)

        self.assertTrue(self.client.login(username='admin', password='admin'))

        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))

        self.assertEquals(GroupedMessage.objects.count(), 1)
        self.assertEquals(Message.objects.count(), 2)
        last = Message.objects.order_by('-id')[0]
        self.assertTrue('user' in last.data['__sentry__'])
        user_info = last.data['__sentry__']['user']
        self.assertTrue('is_authenticated' in user_info)
        self.assertTrue(user_info['is_authenticated'])
        self.assertTrue('username' in user_info)
        self.assertEquals(user_info['username'], 'admin')
        self.assertTrue('email' in user_info)
        self.assertEquals(user_info['email'], 'admin@example.com')

    def test_request_middleware_exception(self):
        orig = list(django_settings.MIDDLEWARE_CLASSES)
        django_settings.MIDDLEWARE_CLASSES = orig + ['tests.middleware.BrokenRequestMiddleware',]

        self.assertRaises(ImportError, self.client.get, reverse('sentry'))
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'ImportError')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'request')
        self.assertEquals(last.view, 'tests.middleware.process_request')

        django_settings.MIDDLEWARE_CLASSES = orig

    # XXX: Django doesn't handle response middleware exceptions (yet)
    # def test_response_middlware_exception(self):
    #     orig = list(django_settings.MIDDLEWARE_CLASSES)
    #     django_settings.MIDDLEWARE_CLASSES = orig + ['tests.middleware.BrokenResponseMiddleware',]
    #
    #     self.assertRaises(ImportError, self.client.get, reverse('sentry'))
    #     self.assertEquals(Message.objects.count(), 1)
    #     self.assertEquals(GroupedMessage.objects.count(), 1)
    #     last = Message.objects.get()
    #     self.assertEquals(last.logger, 'root')
    #     self.assertEquals(last.class_name, 'ImportError')
    #     self.assertEquals(last.level, logging.ERROR)
    #     self.assertEquals(last.message, 'response')
    #     self.assertEquals(last.view, 'tests.middleware.process_response')
    #
    #     django_settings.MIDDLEWARE_CLASSES = orig

    def test_view_middleware_exception(self):
        orig = list(django_settings.MIDDLEWARE_CLASSES)
        django_settings.MIDDLEWARE_CLASSES = orig + ['tests.middleware.BrokenViewMiddleware',]

        self.assertRaises(ImportError, self.client.get, reverse('sentry'))
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'ImportError')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'view')
        self.assertEquals(last.view, 'tests.middleware.process_view')

        django_settings.MIDDLEWARE_CLASSES = orig

    def test_setting_name(self):
        orig_name = settings.NAME
        orig_site = settings.SITE
        settings.NAME = 'foo'
        settings.SITE = 'bar'

        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'Exception')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'view exception')
        self.assertEquals(last.server_name, 'foo')
        self.assertEquals(last.site, 'bar')
        self.assertEquals(last.view, 'tests.views.raise_exc')

        settings.NAME = orig_name
        settings.SITE = orig_site

    def test_exclusion_view_path(self):
        try: Message.objects.get(pk=1341324)
        except: get_client().create_from_exception()

        last = Message.objects.get()

        self.assertEquals(last.view, 'tests.tests.test_exclusion_view_path')

    def test_best_guess_view(self):
        settings.EXCLUDE_PATHS = ['tests.tests']

        try: Message.objects.get(pk=1341324)
        except: get_client().create_from_exception()

        last = Message.objects.get()

        self.assertEquals(last.view, 'tests.tests.test_best_guess_view')

        settings.EXCLUDE_PATHS = []

    def test_exclude_modules_view(self):
        settings.EXCLUDE_PATHS = ['tests.views.decorated_raise_exc']

        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc-decor'))

        last = Message.objects.get()

        self.assertEquals(last.view, 'tests.views.raise_exc')

        settings.EXCLUDE_PATHS = []

    def test_varying_messages(self):
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc') + '?message=foo')
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc') + '?message=bar')
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc') + '?message=gra')

        self.assertEquals(GroupedMessage.objects.count(), 1)

    def test_include_modules(self):
        settings.INCLUDE_PATHS = ['django.shortcuts.get_object_or_404']

        self.assertRaises(Exception, self.client.get, reverse('sentry-django-exc'))

        last = Message.objects.get()

        self.assertEquals(last.view, 'django.shortcuts.get_object_or_404')

        settings.INCLUDE_PATHS = []

    def test_template_name_as_view(self):
        self.assertRaises(TemplateSyntaxError, self.client.get, reverse('sentry-template-exc'))

        last = Message.objects.get()

        self.assertEquals(last.view, 'sentry-tests/error.html')

    def test_request_in_logging(self):
        resp = self.client.get(reverse('sentry-log-request-exc'))
        self.assertEquals(resp.status_code, 200)

        last = Message.objects.get()

        self.assertEquals(last.view, 'tests.views.logging_request_exc')
        self.assertEquals(last.data['META']['REMOTE_ADDR'], '127.0.0.1')

    def test_sample_data_in_group(self):
        resp = self.client.get(reverse('sentry-log-request-exc'))
        self.assertEquals(resp.status_code, 200)

        last = GroupedMessage.objects.get()

        self.assertEquals(last.view, 'tests.views.logging_request_exc')
        self.assertEquals(last.data['url'], 'http://testserver' + reverse('sentry-log-request-exc'))

    def test_create_from_record_none_exc_info(self):
        # sys.exc_info can return (None, None, None) if no exception is being
        # handled anywhere on the stack. See:
        #  http://docs.python.org/library/sys.html#sys.exc_info
        client = get_client()
        record = logging.LogRecord(
            'foo',
            logging.INFO,
            pathname=None,
            lineno=None,
            msg='test',
            args=(),
            exc_info=(None, None, None),
        )
        message_id = client.create_from_record(record)
        message = Message.objects.get(message_id=message_id)

        self.assertEquals('test', message.message)

    def test_group_formatting(self):
        logger = logging.getLogger()

        self.setUpHandler()

        logger.error('This is a test %s', 'error')
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')

        logger.error('This is a test %s', 'message')
        logger.error('This is a test %s', 'foo')

        self.assertEquals(Message.objects.count(), 3)
        self.assertEquals(GroupedMessage.objects.count(), 1)

    def test_uuid(self):
        import uuid

        logger = logging.getLogger()

        self.setUpHandler()

        uuid = uuid.uuid4()

        logger.error('Test', extra={'data': {'uuid': uuid}})
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'Test')
        self.assertEquals(last.data['uuid'], repr(uuid))

    def test_versions(self):
        import sentry
        resp = self.client.get(reverse('sentry-log-request-exc'))
        self.assertEquals(resp.status_code, 200)

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)

        last = Message.objects.get()
        self.assertTrue('versions' in last.data['__sentry__'], last.data['__sentry__'])
        self.assertTrue('sentry' in last.data['__sentry__']['versions'], last.data['__sentry__'])
        self.assertEquals(last.data['__sentry__']['versions']['sentry'], sentry.VERSION)
        self.assertTrue('module' in last.data['__sentry__'], last.data['__sentry__'])
        self.assertEquals(last.data['__sentry__']['module'], 'tests')
        self.assertTrue('version' in last.data['__sentry__'], last.data['__sentry__'])
        self.assertEquals(last.data['__sentry__']['version'], '1.0')

        last = GroupedMessage.objects.get()
        self.assertTrue('module' in last.data)
        self.assertEquals(last.data['module'], 'tests')
        self.assertTrue('version' in last.data)
        self.assertEquals(last.data['version'], '1.0')

    def test_404_middleware(self):
        existing = django_settings.MIDDLEWARE_CLASSES

        django_settings.MIDDLEWARE_CLASSES = (
            'sentry.client.middleware.Sentry404CatchMiddleware',
        ) + django_settings.MIDDLEWARE_CLASSES

        resp = self.client.get('/non-existant-page')
        self.assertEquals(resp.status_code, 404)

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.url, u'http://testserver/non-existant-page')
        self.assertEquals(last.level, logging.INFO)
        self.assertEquals(last.logger, 'http404')

        django_settings.MIDDLEWARE_CLASSES = existing

    def test_response_error_id_middleware(self):
        # TODO: test with 500s
        existing = django_settings.MIDDLEWARE_CLASSES

        django_settings.MIDDLEWARE_CLASSES = (
            'sentry.client.middleware.SentryResponseErrorIdMiddleware',
            'sentry.client.middleware.Sentry404CatchMiddleware',
        ) + django_settings.MIDDLEWARE_CLASSES

        resp = self.client.get('/non-existant-page')
        self.assertEquals(resp.status_code, 404)
        headers = dict(resp.items())
        self.assertTrue(headers.get('X-Sentry-ID'))
        self.assertTrue(Message.objects.filter(message_id=headers['X-Sentry-ID']).exists())

        django_settings.MIDDLEWARE_CLASSES = existing

    def test_extra_storage(self):
        from sentry.utils import MockDjangoRequest

        request = MockDjangoRequest(
            META = {'foo': 'bar'},
        )

        logger = logging.getLogger()

        self.setUpHandler()

        logger.error('This is a test %s', 'error', extra={
            'request': request,
            'data': {
                'baz': 'bar',
            }
        })
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')
        self.assertTrue('META' in last.data)
        self.assertTrue('foo' in last.data['META'])
        self.assertEquals(last.data['META']['foo'], 'bar')
        self.assertTrue('baz' in last.data)
        self.assertEquals(last.data['baz'], 'bar')

    def test_raw_post_data(self):
        from sentry.utils import MockDjangoRequest

        request = MockDjangoRequest(
            raw_post_data = '{"json": "string"}',
        )

        logger = logging.getLogger()

        self.setUpHandler()

        logger.error('This is a test %s', 'error', extra={
            'request': request,
            'data': {
                'baz': 'bar',
            }
        })
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')
        self.assertTrue('POST' in last.data)
        self.assertEquals(request.raw_post_data, last.data['POST'])

    def test_score_update(self):
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))

        self.assertEquals(GroupedMessage.objects.count(), 1)
        group = GroupedMessage.objects.get()
        self.assertTrue(group.score > 0, group.score)

        # drop the score to ensure its getting re-set
        group.score = 0
        group.save()

        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        self.assertEquals(GroupedMessage.objects.count(), 1)

        group = GroupedMessage.objects.get()
        self.assertTrue(group.score > 0, group.score)

    def test_shorten_lists(self):
        logger = logging.getLogger()

        self.setUpHandler()

        base_list = range(500)

        logger.error('This is a test %s', 'error', extra={'data': {
            'list': base_list,
            'set': set(base_list),
            'tuple': tuple(base_list),
            'frozenset': frozenset(base_list),
        }})
        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        last = Message.objects.get()

        # test list length
        self.assertTrue('list' in last.data)
        self.assertEquals(len(last.data['list']), 52) # 20 + 2 extra ele
        self.assertEquals(last.data['list'][-2], '...')
        self.assertEquals(last.data['list'][-1], '(450 more elements)')

        # test set length
        self.assertTrue('set' in last.data)
        self.assertEquals(len(last.data['set']), 52) # 20 + 2 extra ele
        self.assertEquals(last.data['set'][-2], '...')
        self.assertEquals(last.data['set'][-1], '(450 more elements)')

        # test frozenset length
        self.assertTrue('frozenset' in last.data)
        self.assertEquals(len(last.data['frozenset']), 52) # 20 + 2 extra ele
        self.assertEquals(last.data['frozenset'][-2], '...')
        self.assertEquals(last.data['frozenset'][-1], '(450 more elements)')

        # test tuple length
        self.assertTrue('tuple' in last.data)
        self.assertEquals(len(last.data['tuple']), 52) # 20 + 2 extra ele
        self.assertEquals(last.data['tuple'][-2], '...')
        self.assertEquals(last.data['tuple'][-1], '(450 more elements)')

    def test_denormalized_counters(self):
        settings.MINUTE_NORMALIZATION = 0

        get_client().create_from_text('hi', timestamp=datetime.datetime.now() - datetime.timedelta(minutes=3))

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        self.assertEquals(MessageCountByMinute.objects.count(), 1)
        self.assertEquals(MessageFilterValue.objects.count(), 3)
        self.assertEquals(FilterValue.objects.count(), 3)

        group = GroupedMessage.objects.get()

        count = MessageCountByMinute.objects.get()
        self.assertEquals(count.group, group)
        self.assertEquals(count.times_seen, 1)
        self.assertEquals(count.date, group.last_seen.replace(second=0, microsecond=0))

        filter_map = dict((m.key, m) for m in MessageFilterValue.objects.all().order_by('key', 'value'))

        self.assertTrue('server_name' in filter_map)
        filtervalue = filter_map['server_name']
        self.assertEquals(filtervalue.group, group)
        self.assertEquals(filtervalue.times_seen, 1)
        self.assertEquals(filtervalue.key, 'server_name')
        self.assertEquals(filtervalue.value, settings.NAME)

        self.assertTrue('site' in filter_map)
        filtervalue = filter_map['site']
        self.assertEquals(filtervalue.group, group)
        self.assertEquals(filtervalue.times_seen, 1)
        self.assertEquals(filtervalue.key, 'site')
        self.assertEquals(filtervalue.value, settings.SITE)

        self.assertTrue('logger' in filter_map)
        filtervalue = filter_map['logger']
        self.assertEquals(filtervalue.group, group)
        self.assertEquals(filtervalue.times_seen, 1)
        self.assertEquals(filtervalue.key, 'logger')
        self.assertEquals(filtervalue.value, 'root')

        filter_map = dict((m.key, m) for m in FilterValue.objects.all().order_by('key', 'value'))

        self.assertTrue('server_name' in filter_map)
        filtervalue = filter_map['server_name']
        self.assertEquals(filtervalue.key, 'server_name')
        self.assertEquals(filtervalue.value, settings.NAME)

        self.assertTrue('site' in filter_map)
        filtervalue = filter_map['site']
        self.assertEquals(filtervalue.key, 'site')
        self.assertEquals(filtervalue.value, settings.SITE)

        self.assertTrue('logger' in filter_map)
        filtervalue = filter_map['logger']
        self.assertEquals(filtervalue.key, 'logger')
        self.assertEquals(filtervalue.value, 'root')

        get_client().create_from_text('hi')

        self.assertEquals(Message.objects.count(), 2)
        self.assertEquals(GroupedMessage.objects.count(), 1)
        self.assertEquals(MessageCountByMinute.objects.count(), 2)
        self.assertEquals(MessageFilterValue.objects.count(), 3)
        self.assertEquals(FilterValue.objects.count(), 3)

        group = GroupedMessage.objects.get()

        counts = MessageCountByMinute.objects.all()
        for count in counts:
            self.assertEquals(count.group, group)
            self.assertEquals(count.times_seen, 1)
            self.assertEquals(count.date.second, 0)
            self.assertEquals(count.date.microsecond, 0)

        filter_map = dict((m.key, m) for m in MessageFilterValue.objects.all().order_by('key', 'value'))

        self.assertTrue('server_name' in filter_map)
        filtervalue = filter_map['server_name']
        self.assertEquals(filtervalue.group, group)
        self.assertEquals(filtervalue.times_seen, 2)
        self.assertEquals(filtervalue.key, 'server_name')
        self.assertEquals(filtervalue.value, settings.NAME)

        self.assertTrue('site' in filter_map)
        filtervalue = filter_map['site']
        self.assertEquals(filtervalue.group, group)
        self.assertEquals(filtervalue.times_seen, 2)
        self.assertEquals(filtervalue.key, 'site')
        self.assertEquals(filtervalue.value, settings.SITE)

        self.assertTrue('logger' in filter_map)
        filtervalue = filter_map['logger']
        self.assertEquals(filtervalue.group, group)
        self.assertEquals(filtervalue.times_seen, 2)
        self.assertEquals(filtervalue.key, 'logger')
        self.assertEquals(filtervalue.value, 'root')

        filter_map = dict((m.key, m) for m in FilterValue.objects.all().order_by('key', 'value'))

        self.assertTrue('server_name' in filter_map)
        filtervalue = filter_map['server_name']
        self.assertEquals(filtervalue.key, 'server_name')
        self.assertEquals(filtervalue.value, settings.NAME)

        self.assertTrue('site' in filter_map)
        filtervalue = filter_map['site']
        self.assertEquals(filtervalue.key, 'site')
        self.assertEquals(filtervalue.value, settings.SITE)

        self.assertTrue('logger' in filter_map)
        filtervalue = filter_map['logger']
        self.assertEquals(filtervalue.key, 'logger')
        self.assertEquals(filtervalue.value, 'root')

    # def test_sampling(self):
    #     settings.THRASHING_LIMIT = 0
    #     settings.THRASHING_TIMEOUT = 0
    #
    #     Message.objects.all().delete()
    #     GroupedMessage.objects.all().delete()
    #
    #     message_id = None
    #     for i in xrange(0, 1000):
    #         get_client().create_from_text('hi')
    #
    #     self.assertEquals(GroupedMessage.objects.count(), 1)
    #     group = GroupedMessage.objects.get()
    #     self.assertEquals(group.times_seen, 1000)
    #     self.assertNotEquals(Message.objects.count(), 400)

class SentryViewsTest(BaseTestCase):
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
        self.assertTemplateUsed(resp, 'sentry/index.html')

    def test_get_login_url(self):
        with Settings(LOGIN_URL='/404'):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

        with Settings(LOGIN_URL=reverse('sentry-fake-login')):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-fake-login'))

        # should still be cached
        with Settings(LOGIN_URL='/404'):
            url = get_login_url(False)
            self.assertEquals(url, reverse('sentry-fake-login'))

        with Settings(SENTRY_LOGIN_URL=None):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

    def test_dashboard(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry') + '?sort=freq', follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/index.html')
        self.assertEquals(len(resp.context['message_list']), 4)
        group = resp.context['message_list'][0]
        self.assertEquals(group.times_seen, 7)
        self.assertEquals(group.class_name, 'AttributeError')

    def test_group_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group', args=[2]), follow=True)
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
        resp = self.client.get(reverse('sentry-group-message', args=[2, 4]), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/group/message.html')
        self.assertTrue('group' in resp.context)
        group = GroupedMessage.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

class SentryRemoteTest(BaseTestCase):

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

    def test_broken_cache(self):
        from django.core.cache import cache
        add_func = cache.add
        cache.add = lambda: False

        client = get_client()

        settings.THRASHING_LIMIT = 10
        settings.THRASHING_TIMEOUT = 60

        result = client.check_throttle('foobar')

        self.assertEquals(result, (False, None))

        cache.add = add_func

    # def test_function_exception(self):
    #     try: raise Exception(lambda:'foo')
    #     except: get_client().create_from_exception()
    #
    #     last = Message.objects.get()
    #
    #     self.assertEquals(last.view, 'tests.tests.testFunctionException')

class SentryRemoteServerTest(TransactionTestCase):
    urls = 'tests.urls'

    def setUp(self):
        self.server_thread = None
        logger = logging.getLogger('sentry')
        for h in logger.handlers:
            logger.removeHandler(h)
        logger.addHandler(logging.StreamHandler())

    def tearDown(self):
        self.stop_test_server()
        settings.REMOTE_URL = None

    def start_test_server(self, host='localhost', port=None):
        """Creates a live test server object (instance of WSGIServer)."""
        if not port:
            for port in xrange(8001, 8050):
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    s.bind((host, port))
                except socket.error:
                    port = None
                    continue
                else:
                    break
                finally:
                    s.close()
        if not port:
            raise socket.error('Unable to find an open port to bind server')

        self._orig_remote_url = settings.REMOTE_URL
        settings.REMOTE_URL = ['http://%s:%s/store/' % (host, port)]
        self.server_thread = TestServerThread(self, host, port)
        self.server_thread.start()
        self.server_thread.started.wait()
        if self.server_thread.error:
            raise self.server_thread.error

    def stop_test_server(self):
        if self.server_thread:
            settings.REMOTE_URL = self._orig_remote_url
            self.server_thread.join()

    def test_process(self):
        self.start_test_server()
        message_id = SentryClient().process(message='hello')
        self.stop_test_server()

        self.assertTrue(message_id)
        instance = Message.objects.all().order_by('-id')[0]
        self.assertEquals(instance.message, 'hello')

    def test_external(self):
        self.start_test_server()
        path = reverse('sentry-raise-exc')
        self.stop_test_server()

        self.assertRaises(Exception, self.client.get, path)
        instance = Message.objects.all().order_by('-id')[0]
        self.assertEquals(instance.message, 'view exception')
        self.assertEquals(instance.url, 'http://testserver' + path)

    def test_timestamp(self):
        timestamp = datetime.datetime.now() - datetime.timedelta(hours=1)

        self.start_test_server()
        message_id = SentryClient().process(message='hello', timestamp=timestamp)
        self.stop_test_server()

        self.assertTrue(message_id)
        instance = Message.objects.all().order_by('-id')[0]
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.datetime, timestamp)
        group = instance.group
        self.assertEquals(group.first_seen, timestamp)
        self.assertEquals(group.last_seen, timestamp)

class SentryFeedsTest(BaseTestCase):
    fixtures = ['tests/fixtures/feeds.json']

    def test_message_feed(self):
        response = self.client.get(reverse('sentry-feed-messages'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>log messages</title>' in response.content)
        self.assertTrue('<link>http://testserver/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>TypeError: exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

    def test_summary_feed(self):
        response = self.client.get(reverse('sentry-feed-summaries'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>log summaries</title>' in response.content)
        self.assertTrue('<link>http://testserver/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>(1) TypeError: exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

class SentryMailTest(BaseTestCase):
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

    def test_mail_on_creation(self):
        settings.MAIL = True

        self.assertEquals(len(mail.outbox), 0)
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        self.assertEquals(len(mail.outbox), 1)
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        self.assertEquals(len(mail.outbox), 1)

        out = mail.outbox[0]

        self.assertTrue('Traceback (most recent call last):' in out.body)
        self.assertTrue("<Request" in out.body)
        self.assertEquals(out.subject, '[example.com] [Django] Error (EXTERNAL IP): /trigger-500')

    def test_mail_on_duplication(self):
        settings.MAIL = True

        self.assertEquals(len(mail.outbox), 0)
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        self.assertEquals(len(mail.outbox), 1)
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        self.assertEquals(len(mail.outbox), 1)
        # XXX: why wont this work
        # group = GroupedMessage.objects.update(status=1)
        group = GroupedMessage.objects.all().order_by('-id')[0]
        group.status = 1
        group.save()
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        self.assertEquals(len(mail.outbox), 2)
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        self.assertEquals(len(mail.outbox), 2)

        out = mail.outbox[1]

        self.assertTrue('Traceback (most recent call last):' in out.body)
        self.assertTrue("<Request" in out.body)
        self.assertEquals(out.subject, '[example.com] [Django] Error (EXTERNAL IP): /trigger-500')

    def test_url_prefix(self):
        settings.URL_PREFIX = 'http://example.com'

        group = GroupedMessage.objects.get()
        group.mail_admins(fail_silently=False)

        out = mail.outbox[0]

        self.assertTrue('http://example.com/group/2' in out.body, out.body)

class SentryHelpersTest(BaseTestCase):
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

    def test_get_versions(self):
        import sentry
        from sentry.utils import get_versions
        versions = get_versions(['sentry'])
        self.assertEquals(versions.get('sentry'), sentry.VERSION)
        versions = get_versions(['sentry.client'])
        self.assertEquals(versions.get('sentry'), sentry.VERSION)

class SentryTransformTest(BaseTestCase):
    def test_bad_string(self):
        x = 'The following character causes problems: \xd4'

        result = transform(x)
        self.assertEquals(result, '(Error decoding value)')

    def test_model_instance(self):
        instance = DuplicateKeyModel(foo='foo')

        result = transform(instance)
        self.assertEquals(result, '<DuplicateKeyModel: foo>')

    def test_handles_gettext_lazy(self):
        def fake_gettext(to_translate):
            return u'Igpay Atinlay'

        fake_gettext_lazy = lazy(fake_gettext, str)

        self.assertEquals(
            pickle.loads(pickle.dumps(
                    transform(fake_gettext_lazy("something")))),
            u'Igpay Atinlay')

    def test_dict_keys(self):
        x = {u'foo': 'bar'}

        result = transform(x)
        keys = result.keys()
        self.assertEquals(len(keys), 1)
        self.assertEquals(keys[0], 'foo')
        self.assertTrue(isinstance(keys[0], str))

class SentryClientTest(BaseTestCase):
    def setUp(self):
        self._client = settings.CLIENT

    def tearDown(self):
        settings.CLIENT = self._client

    def test_get_client(self):
        from sentry.client.log import LoggingSentryClient

        self.assertEquals(get_client().__class__, SentryClient)
        self.assertEquals(get_client(), get_client())

        settings.CLIENT = 'sentry.client.log.LoggingSentryClient'

        self.assertEquals(get_client().__class__, LoggingSentryClient)
        self.assertEquals(get_client(), get_client())

        settings.CLIENT = 'sentry.client.base.SentryClient'

    def test_logging_client(self):
        settings.CLIENT = 'sentry.client.log.LoggingSentryClient'

        client = get_client()

        _foo = {'': None}

        class handler(logging.Handler):
            def emit(self, record):
                _foo[''] = record

        logger = client.logger
        logger.addHandler(handler())

        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))

        self.assertEquals(_foo[''].getMessage(), 'view exception')
        self.assertEquals(_foo[''].levelno, client.default_level)
        self.assertEquals(_foo[''].class_name, 'Exception')

    @conditional_on_module('djcelery')
    def test_celery_client(self):
        from sentry.client.celery import CelerySentryClient

        self.assertEquals(get_client().__class__, SentryClient)
        self.assertEquals(get_client(), get_client())

        settings.CLIENT = 'sentry.client.celery.CelerySentryClient'

        self.assertEquals(get_client().__class__, CelerySentryClient)
        self.assertEquals(get_client(), get_client())

        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))

        message = GroupedMessage.objects.get()
        self.assertEqual(message.class_name, 'Exception')
        self.assertEqual(message.message, 'view exception')

        settings.CLIENT = 'sentry.client.base.SentryClient'

    # XXX: need to fix behavior with threads so this test works correctly
    # def test_async_client(self):
    #     from sentry.client.async import AsyncSentryClient
    #
    #     self.assertEquals(get_client().__class__, SentryClient)
    #     self.assertEquals(get_client(), get_client())
    #
    #     settings.CLIENT = 'sentry.client.async.AsyncSentryClient'
    #
    #     self.assertEquals(get_client().__class__, AsyncSentryClient)
    #     self.assertEquals(get_client(), get_client())
    #
    #     self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
    #
    #     message = GroupedMessage.objects.get()
    #     self.assertEqual(message.class_name, 'Exception')
    #     self.assertEqual(message.message, 'view exception')
    #
    #     settings.CLIENT = 'sentry.client.base.SentryClient'

class SentryCleanupTest(BaseTestCase):
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

class SentrySearchTest(BaseTestCase):
    @conditional_on_module('haystack')
    def test_build_index(self):
        from sentry.web.views import get_search_query_set
        logger.error('test search error')

        qs = get_search_query_set('error')
        self.assertEquals(qs.count(), 1)
        self.assertEquals(qs[0:1][0].message, 'test search error')

class SentryPluginTest(BaseTestCase):
    def test_registration(self):
        from sentry.plugins import GroupActionProvider
        self.assertEquals(len(GroupActionProvider.plugins), 4)

    def test_get_widgets(self):
        from sentry.templatetags.sentry_helpers import get_widgets
        get_client().create_from_text('hi')

        group = GroupedMessage.objects.get()
        widgets = list(get_widgets(group, MockDjangoRequest()))
        self.assertEquals(len(widgets), 3)

    def test_get_panels(self):
        from sentry.templatetags.sentry_helpers import get_panels
        get_client().create_from_text('hi')

        group = GroupedMessage.objects.get()
        widgets = list(get_panels(group, MockDjangoRequest()))
        self.assertEquals(len(widgets), 3)

    def test_get_actions(self):
        from sentry.templatetags.sentry_helpers import get_actions
        get_client().create_from_text('hi')

        group = GroupedMessage.objects.get()
        widgets = list(get_actions(group, MockDjangoRequest()))
        self.assertEquals(len(widgets), 1)
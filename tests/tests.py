# -*- coding: utf-8 -*-

import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import datetime
import getpass
import logging
import os.path
import socket
import sys
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
from sentry.models import Message, GroupedMessage
from sentry.utils import json
from sentry.utils import transform, get_signature, get_auth_header

from models import TestModel, DuplicateKeyModel
from utils import TestServerThread, conditional_on_module

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

class SentryTestCase(BaseTestCase):
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
    
    def testLogger(self):
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
            logger.info('This is a test info with an exception', exc_info=sys.exc_info())
            self.assertEquals(Message.objects.count(), 6)
            self.assertEquals(GroupedMessage.objects.count(), 5)
            last = Message.objects.all().order_by('-id')[0:1].get()
            self.assertEquals(last.class_name, 'ValueError')
            self.assertEquals(last.message, 'This is a test info with an exception')
            self.assertTrue(last.data.get('__sentry__', {}).get('exc'))

        self.tearDownHandler()

    # def test404Middleware(self):
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

    def testAPI(self):
        try:
            Message.objects.get(id=999999989)
        except Message.DoesNotExist, exc:
            message_id = get_client().create_from_exception()
            error = Message.objects.get(message_id=message_id)
            self.assertTrue(error.data.get('__sentry__', {}).get('exc'))
        else:
            self.fail('Unable to create `Message` entry.')

        try:
            Message.objects.get(id=999999989)
        except Message.DoesNotExist, exc:
            message_id = get_client().create_from_exception()
            error = Message.objects.get(message_id=message_id)
            self.assertTrue(error.data.get('__sentry__', {}).get('exc'))
        else:
            self.fail('Unable to create `Message` entry.')

        self.assertEquals(Message.objects.count(), 2)
        self.assertEquals(GroupedMessage.objects.count(), 2)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))
        
        get_client().create_from_text('This is an error', level=logging.DEBUG)
        
        self.assertEquals(Message.objects.count(), 3)
        self.assertEquals(GroupedMessage.objects.count(), 3)
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.DEBUG)
        self.assertEquals(last.message, 'This is an error')
        
    def testAlternateDatabase(self):
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
    
    def testIncorrectUnicode(self):
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
            logging.info('test', exc_info=sys.exc_info())
        self.assertEquals(Message.objects.count(), cnt+5)
        
        self.tearDownHandler()

    def testCorrectUnicode(self):
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
            logging.info('test', exc_info=sys.exc_info())
        self.assertEquals(Message.objects.count(), cnt+5)
        
        self.tearDownHandler()
    
    def testLongURLs(self):
        # Fix: #6 solves URLs > 200 characters
        message_id = get_client().create_from_text('hello world', url='a'*210)
        error = Message.objects.get(message_id=message_id)

        self.assertEquals(error.url, 'a'*200)
        self.assertEquals(error.data['url'], 'a'*210)
    
    def testThrashing(self):
        settings.THRASHING_LIMIT = 10
        settings.THRASHING_TIMEOUT = 60
        
        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()
        
        message_id = None
        for i in range(0, 10):
            this_message_id = get_client().create_from_text('hi')
            self.assertTrue(this_message_id is not None)
            self.assertNotEquals(this_message_id, message_id)
            message_id = this_message_id

        for i in range(0, 40):
            this_message_id = get_client().create_from_text('hi')
            self.assertEquals(this_message_id, message_id)
        
        self.assertEquals(Message.objects.count(), settings.THRASHING_LIMIT)
    
    def testSignals(self):
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

    def testSignalsWithoutRequest(self):
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

    def testNoThrashing(self):
        prev = settings.THRASHING_LIMIT
        settings.THRASHING_LIMIT = 0
        
        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()
        
        for i in range(0, 50):
            get_client().create_from_text('hi')
        
        self.assertEquals(Message.objects.count(), 50)

        settings.THRASHING_LIMIT = prev

    def testDatabaseMessage(self):
        from django.db import connection
        
        try:
            cursor = connection.cursor()
            cursor.execute("select foo")
        except:
            got_request_exception.send(sender=self.__class__)

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)

    def testIntegrityMessage(self):
        DuplicateKeyModel.objects.create()
        try:
            DuplicateKeyModel.objects.create()
        except:
            got_request_exception.send(sender=self.__class__)
        else:
            self.fail('Excepted an IntegrityMessage to be raised.')

        self.assertEquals(Message.objects.count(), 1)
        self.assertEquals(GroupedMessage.objects.count(), 1)

    def testViewException(self):
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc'))
        
        self.assertEquals(GroupedMessage.objects.count(), 1)
        self.assertEquals(Message.objects.count(), 1)
        last = Message.objects.get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'Exception')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'view exception')
        self.assertEquals(last.view, 'tests.views.raise_exc')

    def testRequestMiddlwareException(self):
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
    # def testResponseMiddlwareException(self):
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

    def testViewMiddlewareException(self):
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

    def testSettingName(self):
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

    def testExclusionViewPath(self):
        try: Message.objects.get(pk=1341324)
        except: get_client().create_from_exception()
        
        last = Message.objects.get()
        
        self.assertEquals(last.view, 'tests.tests.testExclusionViewPath')

    def testBestGuessView(self):
        settings.EXCLUDE_PATHS = ['tests.tests']
        
        try: Message.objects.get(pk=1341324)
        except: get_client().create_from_exception()
        
        last = Message.objects.get()
        
        self.assertEquals(last.view, 'tests.tests.testBestGuessView')
        
        settings.EXCLUDE_PATHS = []

    def testExcludeModulesView(self):
        settings.EXCLUDE_PATHS = ['tests.views.decorated_raise_exc']
        
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc-decor'))
        
        last = Message.objects.get()
        
        self.assertEquals(last.view, 'tests.views.raise_exc')
        
        settings.EXCLUDE_PATHS = []

    def testVaryingMessages(self):
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc') + '?message=foo')
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc') + '?message=bar')
        self.assertRaises(Exception, self.client.get, reverse('sentry-raise-exc') + '?message=gra')

        self.assertEquals(GroupedMessage.objects.count(), 1)

    def testIncludeModules(self):
        settings.INCLUDE_PATHS = ['django.shortcuts.get_object_or_404']
        
        self.assertRaises(Exception, self.client.get, reverse('sentry-django-exc'))
        
        last = Message.objects.get()
        
        self.assertEquals(last.view, 'django.shortcuts.get_object_or_404')
        
        settings.INCLUDE_PATHS = []

    def testTemplateNameAsView(self):
        self.assertRaises(TemplateSyntaxError, self.client.get, reverse('sentry-template-exc'))
        
        last = Message.objects.get()
        
        self.assertEquals(last.view, 'sentry-tests/error.html')

    def testRequestInLogging(self):
        resp = self.client.get(reverse('sentry-log-request-exc'))
        self.assertEquals(resp.status_code, 200)
        
        last = Message.objects.get()
        
        self.assertEquals(last.view, 'tests.views.logging_request_exc')
        self.assertEquals(last.data['META']['REMOTE_ADDR'], '127.0.0.1')

    def testSampleDataInGroup(self):
        resp = self.client.get(reverse('sentry-log-request-exc'))
        self.assertEquals(resp.status_code, 200)
        
        last = GroupedMessage.objects.get()
        
        self.assertEquals(last.view, 'tests.views.logging_request_exc')
        self.assertEquals(last.data['url'], 'http://testserver' + reverse('sentry-log-request-exc'))
        
    def testCreateFromRecordNoneExcInfo(self):
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

    def testGroupFormatting(self):
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
    
    def testUUID(self):
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

    def testVersions(self):
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

    def test404Middleware(self):
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

    def testResponseErrorIdMiddleware(self):
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

    def testExtraStorage(self):
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

    def testRawPostData(self):
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

    def testScoreUpdate(self):
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

    def testShortenLists(self):
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

class SentryViewsTest(BaseTestCase):
    fixtures = ['tests/fixtures/views.json']
    
    def setUp(self):
        settings.DATABASE_USING = None
        self._handlers = None
        self._level = None
        settings.DEBUG = False
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()
    
    def tearDown(self):
        self.tearDownHandler()
        
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

    def testTestAuth(self):
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/login.html')

    def testDashboard(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry') + '?sort=freq', follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/index.html')
        self.assertEquals(len(resp.context['message_list']), 4)
        group = resp.context['message_list'][0]
        self.assertEquals(group.times_seen, 7)
        self.assertEquals(group.class_name, 'AttributeError')

    def testGroup(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group', args=[2]), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/group/details.html')

class SentryRemoteTest(BaseTestCase):
    
    def setUp(self):
        settings.REMOTE_URL = ['http://localhost:8000%s' % reverse('sentry-store')]
        logger = logging.getLogger('sentry')
        for h in logger.handlers:
            logger.removeHandler(h)
        logger.addHandler(logging.StreamHandler())

    def tearDown(self):
        settings.REMOTE_URL = None

    def testNoKey(self):
        resp = self.client.post(reverse('sentry-store'))
        self.assertEquals(resp.status_code, 400)

    def testNoData(self):
        resp = self.client.post(reverse('sentry-store'), {
            'key': settings.KEY,
        })
        self.assertEquals(resp.status_code, 400)

    def testBadData(self):
        resp = self.client.post(reverse('sentry-store'), {
            'key': settings.KEY,
            'data': 'hello world',
        })
        self.assertEquals(resp.status_code, 403)
        self.assertEquals(resp.content, 'Bad data decoding request (TypeError, Incorrect padding)')

    def testCorrectData(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Message.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def testUnicodeKeys(self):
        kwargs = {u'message': 'hello', u'server_name': 'not_dcramer.local', u'level': 40, u'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200, resp.content)
        instance = Message.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.level, 40)
        self.assertEquals(instance.site, 'not_a_real_site')

    def testTimestamp(self):
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

    def testTimestampAsISO(self):
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

    def testUngzippedData(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}
        resp = self._postWithSignature(kwargs)
        self.assertEquals(resp.status_code, 200)
        instance = Message.objects.get()
        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    def testByteSequence(self):
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

    def testLegacyAuth(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}

        resp = self._postWithKey(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Message.objects.get()

        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    def testSignature(self):
        kwargs = {'message': 'hello', 'server_name': 'not_dcramer.local', 'level': 40, 'site': 'not_a_real_site'}

        resp = self._postWithSignature(kwargs)

        self.assertEquals(resp.status_code, 200, resp.content)

        instance = Message.objects.get()

        self.assertEquals(instance.message, 'hello')
        self.assertEquals(instance.server_name, 'not_dcramer.local')
        self.assertEquals(instance.site, 'not_a_real_site')
        self.assertEquals(instance.level, 40)

    def testBrokenCache(self):
        from django.core.cache import cache
        add_func = cache.add
        cache.add = lambda: False
        
        client = get_client()
        
        settings.THRASHING_LIMIT = 10
        settings.THRASHING_TIMEOUT = 60
        
        result = client.check_throttle('foobar')

        self.assertEquals(result, (False, None))
        
        cache.add = add_func

    # def testFunctionException(self):
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

    def testProcess(self):
        self.start_test_server()
        message_id = SentryClient().process(message='hello')
        self.stop_test_server()

        self.assertTrue(message_id)
        instance = Message.objects.all().order_by('-id')[0]
        self.assertEquals(instance.message, 'hello')

    def testExternal(self):
        self.start_test_server()
        path = reverse('sentry-raise-exc')
        self.stop_test_server()

        self.assertRaises(Exception, self.client.get, path)
        instance = Message.objects.all().order_by('-id')[0]
        self.assertEquals(instance.message, 'view exception')
        self.assertEquals(instance.url, 'http://testserver' + path)

    def testTimestamp(self):
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
    
    def testMessageFeed(self):
        response = self.client.get(reverse('sentry-feed-messages'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>log messages</title>' in response.content)
        self.assertTrue('<link>http://testserver/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>TypeError: exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

    def testSummaryFeed(self):
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

class SentryCommandTest(BaseTestCase):
    fixtures = ['tests/fixtures/cleanup.json']
    
    def test_cleanup(self):
        from sentry.scripts.runner import cleanup
        
        self.assertEquals(Message.objects.count(), 10)
        
        cleanup(days=1)
        
        self.assertEquals(Message.objects.count(), 0)

class SentrySearchTest(BaseTestCase):
    @conditional_on_module('haystack')
    def test_build_index(self):
        from sentry.web.views import get_search_query_set
        logger.error('test search error')
        
        qs = get_search_query_set('error')
        self.assertEquals(qs.count(), 1)
        self.assertEquals(qs[0:1][0].message, 'test search error')
# -*- coding: utf-8 -*-

from django.core.handlers.wsgi import WSGIRequest
from django.core.urlresolvers import reverse
from django.core.signals import got_request_exception
from django.test.client import Client
from django.test import TestCase
from django.utils.encoding import smart_unicode

from sentry.middleware import DBLogMiddleware
from sentry.models import Message, GroupedMessage
from sentry.tests.models import TestModel, DuplicateKeyModel
from sentry import settings

import logging
import sys

def conditional_on_module(module):
    def wrapped(func):
        def inner(self, *args, **kwargs):
            try:
                __import__(module)
            except ImportError:
                print "Skipping test: %s.%s" % (self.__class__.__name__, func.__name__)
            else:
                return func(self, *args, **kwargs)
        return inner
    return wrapped

class RequestFactory(Client):
    # Used to generate request objects.
    def request(self, **request):
        environ = {
            'HTTP_COOKIE': self.cookies,
            'PATH_INFO': '/',
            'QUERY_STRING': '',
            'REQUEST_METHOD': 'GET',
            'SCRIPT_NAME': '',
            'SERVER_NAME': 'testserver',
            'SERVER_PORT': 80,
            'SERVER_PROTOCOL': 'HTTP/1.1',
        }
        environ.update(self.defaults)
        environ.update(request)
        return WSGIRequest(environ)
 
RF = RequestFactory()

class DBLogTestCase(TestCase):
    urls = 'sentry.tests.urls'

    def setUp(self):
        settings.DATABASE_USING = None
        self._handlers = None
        self._level = None
        settings.DEBUG = False
        self.logger = logging.getLogger('sentry')
        self.logger.addHandler(logging.StreamHandler())
        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()

    def tearDown(self):
        self.tearDownHandler()
        
    def setUpHandler(self):
        self.tearDownHandler()
        from sentry.handlers import DBLogHandler
        
        logger = logging.getLogger()
        self._handlers = logger.handlers
        self._level = logger.level

        for h in self._handlers:
            # TODO: fix this, for now, I don't care.
            logger.removeHandler(h)
    
        logger.setLevel(logging.DEBUG)
        sentry_handler = DBLogHandler()
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
        
    def testLogger(self):
        logger = logging.getLogger()
        
        self.setUpHandler()

        logger.error('This is a test error')
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')

        logger.warning('This is a test warning')
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (2, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.WARNING)
        self.assertEquals(last.message, 'This is a test warning')
        
        logger.error('This is a test error')
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (3, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')
    
        logger = logging.getLogger('test')
        logger.info('This is a test info')
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (4, 3), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'test')
        self.assertEquals(last.level, logging.INFO)
        self.assertEquals(last.message, 'This is a test info')
        
        logger.info('This is a test info with a url', extra=dict(url='http://example.com'))
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (5, 4), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.url, 'http://example.com')
        
        try:
            raise ValueError('This is a test ValueError')
        except ValueError:
            logger.info('This is a test info with an exception', exc_info=sys.exc_info())
            cur = (Message.objects.count(), GroupedMessage.objects.count())
            self.assertEquals(cur, (6, 5), 'Assumed logs failed to save. %s' % (cur,))
            last = Message.objects.all().order_by('-id')[0:1].get()
            self.assertEquals(last.class_name, 'ValueError')
            self.assertEquals(last.message, 'This is a test info with an exception')
            self.assertTrue(last.data.get('__sentry__', {}).get('exc'))
    
        self.tearDownHandler()
    
    def testMiddleware(self):
        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()
        
        request = RF.get("/", REMOTE_ADDR="127.0.0.1:8000")

        try:
            Message.objects.get(id=999999999)
        except Message.DoesNotExist, exc:
            GroupedMessage.handle_exception(request=request, sender=self)
        else:
            self.fail('Unable to create `Message` entry.')
        
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))
        
    def testAPI(self):
        try:
            Message.objects.get(id=999999989)
        except Message.DoesNotExist, exc:
            Message.objects.create_from_exception(exc)
        else:
            self.fail('Unable to create `Message` entry.')

        try:
            Message.objects.get(id=999999989)
        except Message.DoesNotExist, exc:
            error = Message.objects.create_from_exception()
            self.assertTrue(error.data.get('__sentry__', {}).get('exc'))
        else:
            self.fail('Unable to create `Message` entry.')

        
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (2, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))
        
        Message.objects.create_from_text('This is an error', level=logging.DEBUG)
        
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (3, 3), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.DEBUG)
        self.assertEquals(last.message, 'This is an error')
        
    def testAlternateDatabase(self):
        settings.DATABASE_USING = 'default'
        
        try:
            Message.objects.get(id=999999979)
        except Message.DoesNotExist, exc:
            Message.objects.create_from_exception(exc)
        else:
            self.fail('Unable to create `Message` entry.')
            
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))

        settings.DATABASE_USING = None
    
    def testIncorrectUnicode(self):
        self.setUpHandler()
        
        cnt = Message.objects.count()
        value = 'רונית מגן'

        error = Message.objects.create_from_text(value)
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

    def testCorrectUnicode(self):
        self.setUpHandler()
        
        cnt = Message.objects.count()
        value = 'רונית מגן'.decode('utf-8')

        error = Message.objects.create_from_text(value)
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
        error = Message.objects.create_from_text('hello world', url='a'*210)
        self.assertEquals(error.url, 'a'*200)
        self.assertEquals(error.data['url'], 'a'*210)
    
    def testUseLogging(self):
        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()
        
        request = RF.get("/", REMOTE_ADDR="127.0.0.1:8000")

        try:
            Message.objects.get(id=999999999)
        except Message.DoesNotExist, exc:
            GroupedMessage.handle_exception(request=request, sender=self)
        else:
            self.fail('Expected an exception.')
        
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))
        
        settings.USE_LOGGING = True
        
        logger = logging.getLogger('sentry')
        for h in logger.handlers:
            logger.removeHandler(h)
        logger.addHandler(logging.StreamHandler())
        
        try:
            Message.objects.get(id=999999999)
        except Message.DoesNotExist, exc:
            GroupedMessage.handle_exception(request=request, sender=self)
        else:
            self.fail('Expected an exception.')
        
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        
        settings.USE_LOGGING = False
    
    def testThrashing(self):
        settings.THRASHING_LIMIT = 10
        settings.THRASHING_TIMEOUT = 60
        
        Message.objects.all().delete()
        GroupedMessage.objects.all().delete()
        
        for i in range(0, 50):
            Message.objects.create_from_text('hi')
        
        self.assertEquals(Message.objects.count(), settings.THRASHING_LIMIT)
    
    def testSignals(self):
        request = RF.get("/", REMOTE_ADDR="127.0.0.1:8000")

        try:
            Message.objects.get(id=999999999)
        except Message.DoesNotExist, exc:
            got_request_exception.send(sender=self.__class__, request=request)
        else:
            self.fail('Expected an exception.')
            
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))

    def testSignalsWithoutRequest(self):
        request = RF.get("/", REMOTE_ADDR="127.0.0.1:8000")

        try:
            Message.objects.get(id=999999999)
        except Message.DoesNotExist, exc:
            got_request_exception.send(sender=self.__class__, request=None)
        else:
            self.fail('Expected an exception.')
            
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
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
            Message.objects.create_from_text('hi')
        
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
        
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'Exception')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'view exception')
        self.assertEquals(last.view, 'sentry.tests.views.raise_exc')

class DBLogViewsTest(TestCase):
    urls = 'sentry.tests.urls'
    
    def setUp(self):
        settings.DATABASE_USING = None
        self._handlers = None
        self._level = None
        settings.DEBUG = False
    
    def tearDown(self):
        self.tearDownHandler()
        
    def setUpHandler(self):
        self.tearDownHandler()
        from sentry.handlers import DBLogHandler
        
        logger = logging.getLogger()
        self._handlers = logger.handlers
        self._level = logger.level

        for h in self._handlers:
            # TODO: fix this, for now, I don't care.
            logger.removeHandler(h)
    
        logger.setLevel(logging.DEBUG)
        sentry_handler = DBLogHandler()
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

    def testSignals(self):
        self.assertRaises(Exception, self.client.get, '/')
        
        cur = (Message.objects.count(), GroupedMessage.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Message.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'Exception')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'view exception')

class DBLogFeedsTest(TestCase):
    fixtures = ['sentry/tests/fixtures/feeds.json']
    urls = 'sentry.tests.urls'
    
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
        self.assertTrue('<title>(1) TypeError: TypeError: exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)
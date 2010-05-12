from django.test.client import Client
from django.test import TestCase
from django.core.handlers.wsgi import WSGIRequest
from django.conf import settings
from django.db import models
from django.utils.encoding import smart_unicode

from djangodblog.models import Error, ErrorBatch
from djangodblog.middleware import DBLogMiddleware
from djangodblog.utils import JSONDictField

import logging
import sys

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

class JSONDictModel(models.Model):
    data = JSONDictField(blank=True, null=True)

class JSONDictTestCase(TestCase):
    def testField(self):
        # Let's make sure the default value is correct
        instance = JSONDictModel()
        self.assertEquals(instance.data, {})
        
        instance = JSONDictModel.objects.create(data={'foo': 'bar'})
        self.assertEquals(instance.data.get('foo'), 'bar')
        
        instance = JSONDictModel.objects.get()
        self.assertEquals(instance.data.get('foo'), 'bar')

class DBLogTestCase(TestCase):
    def setUp(self):
        settings.DBLOG_DATABASE = None
        settings.DBLOG_WITH_LOGGER = False

    def testLogger(self):
        from handlers import DBLogHandler

        Error.objects.all().delete()
        ErrorBatch.objects.all().delete()

        dblog_handler = DBLogHandler()

        logger = logging.getLogger()
        for h in logger.handlers:
            # TODO: fix this, for now, I don't care.
            logger.removeHandler(h)

        logger.setLevel(logging.DEBUG)
        logger.addHandler(dblog_handler)

        logger.error('This is a test error')
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')

        logger.warning('This is a test warning')
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (2, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.WARNING)
        self.assertEquals(last.message, 'This is a test warning')
        
        logger.error('This is a test error')
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (3, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')
    
        logger = logging.getLogger('test')
        logger.info('This is a test info')
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (4, 3), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'test')
        self.assertEquals(last.level, logging.INFO)
        self.assertEquals(last.message, 'This is a test info')
        
        logger.info('This is a test info with a url', extra=dict(url='http://example.com'))
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (5, 4), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.url, 'http://example.com')
        
        try:
            raise ValueError('This is a test ValueError')
        except ValueError:
            logger.info('This is a test info with an exception', exc_info=sys.exc_info())
            cur = (Error.objects.count(), ErrorBatch.objects.count())
            self.assertEquals(cur, (6, 5), 'Assumed logs failed to save. %s' % (cur,))
            last = Error.objects.all().order_by('-id')[0:1].get()
            self.assertEquals(last.class_name, 'ValueError')
            self.assertEquals(last.message, 'This is a test info with an exception')
            self.assertTrue(last.data.get('exc'))
            
        logger = logging.getLogger()
        logger.removeHandler(dblog_handler)
    
    def testMiddleware(self):
        Error.objects.all().delete()
        ErrorBatch.objects.all().delete()
        
        request = RF.get("/", REMOTE_ADDR="127.0.0.1:8000")

        try:
            Error.objects.get(id=999999999)
        except Error.DoesNotExist, exc:
            DBLogMiddleware().process_exception(request, exc)
        else:
            self.fail('Unable to create `Error` entry.')
        
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))
        
    def testAPI(self):
        Error.objects.all().delete()
        ErrorBatch.objects.all().delete()

        try:
            Error.objects.get(id=999999989)
        except Error.DoesNotExist, exc:
            Error.objects.create_from_exception(exc)
        else:
            self.fail('Unable to create `Error` entry.')

        try:
            Error.objects.get(id=999999989)
        except Error.DoesNotExist, exc:
            error = Error.objects.create_from_exception()
            self.assertTrue(error.data.get('exc'))
        else:
            self.fail('Unable to create `Error` entry.')

        
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (2, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))
        
        Error.objects.create_from_text('This is an error', level=logging.DEBUG)
        
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (3, 3), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.DEBUG)
        self.assertEquals(last.message, 'This is an error')
        
        
    def testAlternateDatabase(self):
        settings.DBLOG_USING = 'default'
        
        Error.objects.all().delete()
        ErrorBatch.objects.all().delete()

        try:
            Error.objects.get(id=999999979)
        except Error.DoesNotExist, exc:
            Error.objects.create_from_exception(exc)
        else:
            self.fail('Unable to create `Error` entry.')
            
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, smart_unicode(exc))

        settings.DBLOG_DATABASE = None
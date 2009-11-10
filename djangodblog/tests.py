from django.test.client import Client
from django.test import TestCase
from django.core.handlers.wsgi import WSGIRequest
from django.conf import settings
from django.utils.encoding import smart_unicode

from models import Error, ErrorBatch
from middleware import DBLogMiddleware

import logging

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
    def setUp(self):
        settings.DBLOG_DATABASE = None
        settings.DBLOG_WITH_LOGGER = False

    def testLogger(self):
        from handlers import DBLogHandler
        
        Error.objects.all().delete()
        ErrorBatch.objects.all().delete()

        logging.getLogger().addHandler(DBLogHandler())

        logging.error('This is a test error')
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.ERROR)
        self.assertEquals(last.message, 'This is a test error')

        logging.warning('This is a test warning')
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (2, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.WARNING)
        self.assertEquals(last.message, 'This is a test warning')
        
        logging.error('This is a test error')
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
        self.assertEquals(last.level, logging.FATAL)
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
        
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (1, 1), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.class_name, 'DoesNotExist')
        self.assertEquals(last.level, logging.FATAL)
        self.assertEquals(last.message, smart_unicode(exc))
        
        Error.objects.create_from_text('This is an error', level=logging.DEBUG)
        
        cur = (Error.objects.count(), ErrorBatch.objects.count())
        self.assertEquals(cur, (2, 2), 'Assumed logs failed to save. %s' % (cur,))
        last = Error.objects.all().order_by('-id')[0:1].get()
        self.assertEquals(last.logger, 'root')
        self.assertEquals(last.level, logging.DEBUG)
        self.assertEquals(last.message, 'This is an error')
        
        
    def testAlternateDatabase(self):
        settings.DBLOG_DATABASE = dict(
            DATABASE_HOST=settings.DATABASE_HOST,
            DATABASE_PORT=settings.DATABASE_PORT,
            DATABASE_NAME=settings.DATABASE_NAME,
            DATABASE_USER=settings.DATABASE_USER,
            DATABASE_PASSWORD=settings.DATABASE_PASSWORD,
            DATABASE_OPTIONS=settings.DATABASE_OPTIONS,
        )
        
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
        self.assertEquals(last.level, logging.FATAL)
        self.assertEquals(last.message, smart_unicode(exc))

        settings.DBLOG_DATABASE = None
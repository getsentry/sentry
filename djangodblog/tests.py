from django.test.client import Client
from django.test import TestCase
from django.core.handlers.wsgi import WSGIRequest
from django.conf import settings

from models import Error, ErrorBatch
from middleware import DBLogMiddleware

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
    
    def testMiddleware(self):
        request = RF.get("/", REMOTE_ADDR="127.0.0.1:8000")

        ttl = (Error.objects.count(), ErrorBatch.objects.count())

        try:
            Error.objects.get(id=999999999)
        except Error.DoesNotExist, exc:
            DBLogMiddleware().process_exception(request, exc)
        else:
            self.fail('Unable to create `Error` entry.')
        
        cur = (Error.objects.count()-1, ErrorBatch.objects.count()-1)
        self.assertEquals(cur, ttl, 'Counts do not match. Assumed logs failed to save. %s != %s' % (cur, ttl))
        
    def testAPI(self):
        ttl = (Error.objects.count(), ErrorBatch.objects.count())

        try:
            Error.objects.get(id=999999999)
        except Error.DoesNotExist, exc:
            Error.objects.create_from_exception(exc)
        else:
            self.fail('Unable to create `Error` entry.')
        
        cur = (Error.objects.count()-1, ErrorBatch.objects.count()-1)
        self.assertEquals(cur, ttl, 'Counts do not match. Assumed logs failed to save. %s != %s' % (cur, ttl))
        
    def testAlternateDatabase(self):
        settings.DBLOG_DATABASE = dict(
            DATABASE_HOST=settings.DATABASE_HOST,
            DATABASE_PORT=settings.DATABASE_PORT,
            DATABASE_NAME=settings.DATABASE_NAME,
            DATABASE_USER=settings.DATABASE_USER,
            DATABASE_PASSWORD=settings.DATABASE_PASSWORD,
            DATABASE_OPTIONS=settings.DATABASE_OPTIONS,
        )
        
        ttl = (Error.objects.count(), ErrorBatch.objects.count())

        try:
            Error.objects.get(id=999999999)
        except Error.DoesNotExist, exc:
            Error.objects.create_from_exception(exc)
        else:
            self.fail('Unable to create `Error` entry.')
            
        cur = (Error.objects.count()-1, ErrorBatch.objects.count()-1)
        self.assertEquals(cur, ttl, 'Counts do not match. Assumed logs failed to save. %s != %s' % (cur, ttl))

        settings.DBLOG_DATABASE = None
from __future__ import absolute_import

from exam import fixture
from django.http import HttpResponse, StreamingHttpResponse

from sentry.testutils import TestCase
from sentry.middleware.proxy import ContentLengthHeaderMiddleware


class ContentLengthHeaderMiddlewareTest(TestCase):
    middleware = fixture(ContentLengthHeaderMiddleware)

    def test_simple(self):
        response = self.middleware.process_response(None, HttpResponse('lol'))
        assert response['Content-Length'] == '3'
        assert 'Transfer-Encoding' not in response

    def test_streaming(self):
        response = self.middleware.process_response(None, StreamingHttpResponse())
        assert 'Transfer-Encoding' not in response
        assert 'Content-Length' not in response

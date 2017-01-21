from __future__ import absolute_import

from exam import fixture
from django.http import HttpRequest, HttpResponse, StreamingHttpResponse

from sentry.testutils import TestCase
from sentry.middleware.proxy import (
    ContentLengthHeaderMiddleware, SetRemoteAddrFromForwardedFor)


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


class SetRemoteAddrFromForwardedForTestCase(TestCase):
    middleware = fixture(SetRemoteAddrFromForwardedFor)

    def test_ipv4(self):
        request = HttpRequest()
        request.META['HTTP_X_FORWARDED_FOR'] = '8.8.8.8:80,8.8.4.4'
        self.middleware.process_request(request)
        assert request.META['REMOTE_ADDR'] == '8.8.8.8'

    def test_ipv6(self):
        request = HttpRequest()
        request.META['HTTP_X_FORWARDED_FOR'] = '2001:4860:4860::8888,2001:4860:4860::8844'
        self.middleware.process_request(request)
        assert request.META['REMOTE_ADDR'] == '2001:4860:4860::8888'

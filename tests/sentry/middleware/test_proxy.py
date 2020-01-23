from __future__ import absolute_import

from exam import fixture
from django.http import HttpRequest

from sentry.testutils import TestCase
from sentry.middleware.proxy import SetRemoteAddrFromForwardedFor


class SetRemoteAddrFromForwardedForTestCase(TestCase):
    middleware = fixture(SetRemoteAddrFromForwardedFor)

    def test_ipv4(self):
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "8.8.8.8:80,8.8.4.4"
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "8.8.8.8"

    def test_ipv4_whitespace(self):
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "8.8.8.8:80 "
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "8.8.8.8"

    def test_ipv6(self):
        request = HttpRequest()
        request.META["HTTP_X_FORWARDED_FOR"] = "2001:4860:4860::8888,2001:4860:4860::8844"
        self.middleware.process_request(request)
        assert request.META["REMOTE_ADDR"] == "2001:4860:4860::8888"

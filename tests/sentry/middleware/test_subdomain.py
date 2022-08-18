from django.test import RequestFactory

from sentry.middleware.subdomain import SubdomainMiddleware
from sentry.testutils import TestCase


class SubdomainMiddlewareTest(TestCase):
    def test_attaches_subdomain_attribute(self):

        options = {
            "system.base-hostname": "us.dev.getsentry.net:8000",
        }

        def request_with_host(host):
            subdomain_middleware = SubdomainMiddleware(lambda request: request)
            request = RequestFactory().get("/", HTTP_HOST=host)
            return subdomain_middleware(request)

        with self.options(options):
            assert request_with_host("foobar").subdomain is None
            assert request_with_host("dev.getsentry.net:8000").subdomain is None
            assert request_with_host("us.dev.getsentry.net:8000").subdomain is None
            assert request_with_host("foobar.us.dev.getsentry.net:8000").subdomain == "foobar"
            assert request_with_host("FOOBAR.us.dev.getsentry.net:8000").subdomain == "foobar"
            assert request_with_host("foo.bar.us.dev.getsentry.net:8000").subdomain == "foo.bar"
            assert request_with_host("foo.BAR.us.dev.getsentry.net:8000").subdomain == "foo.bar"
            # Invalid subdomain according to RFC 1034/1035.
            assert request_with_host("_smtp._tcp.us.dev.getsentry.net:8000").subdomain is None

        with self.options({}):
            assert request_with_host("foobar").subdomain is None
            assert request_with_host("dev.getsentry.net:8000").subdomain is None
            assert request_with_host("us.dev.getsentry.net:8000").subdomain is None
            assert request_with_host("foobar.us.dev.getsentry.net:8000").subdomain is None
            assert request_with_host("foo.bar.us.dev.getsentry.net:8000").subdomain is None
            assert request_with_host("_smtp._tcp.us.dev.getsentry.net:8000").subdomain is None

import pytest
from django.core.exceptions import MiddlewareNotUsed
from django.http import HttpResponse
from django.test import RequestFactory
from django.test.utils import override_settings

from sentry.middleware.csp import CspHeaderMiddleware, CspReportOnlyHeaderMiddleware
from sentry.testutils import TestCase


class CspHeaderMiddlewareTest(TestCase):
    def test_no_csp_header(self):
        with override_settings(CSP_HEADER=None):
            with pytest.raises(MiddlewareNotUsed):
                CspHeaderMiddleware()

    def test_basic(self):
        csp_header = (
            "Content-Security-Policy",
            (("default-src", ("*",)), ("script-src", ("'self'", "*.example.com"))),
        )
        with override_settings(CSP_HEADER=csp_header):
            middleware = CspHeaderMiddleware()
            request = RequestFactory().get("/")
            response = HttpResponse("lol")
            response["Content-Type"] = "text/html"
            response = middleware.process_response(request, response)
            assert (
                response["Content-Security-Policy"]
                == "default-src *; script-src 'self' *.example.com"
            )

            # shouldn't get applied to non-html pages
            response = HttpResponse("lol")
            response["Content-Type"] = "application/json"
            response = middleware.process_response(None, response)
            assert "Content-Security-Policy" not in response

    def test_existing_header(self):
        csp_header = (
            "Content-Security-Policy",
            (("default-src", ("*",)), ("script-src", ("'self'", "*.example.com"))),
        )
        with override_settings(CSP_HEADER=csp_header):
            middleware = CspHeaderMiddleware()
            request = RequestFactory().get("/")
            response = HttpResponse("lol")
            response["Content-Type"] = "text/html"
            response["Content-Security-Policy"] = "frame-ancestors test"
            response = middleware.process_response(request, response)
            assert (
                response["Content-Security-Policy"]
                == "frame-ancestors test; default-src *; script-src 'self' *.example.com"
            )

    def test_existing_header_overlapping_directive(self):
        csp_header = (
            "Content-Security-Policy",
            (
                ("default-src", ("*",)),
                ("script-src", ("'self'", "*.example.com")),
                ("frame-ancestors", ("'self'",)),
            ),
        )
        with override_settings(CSP_HEADER=csp_header):
            middleware = CspHeaderMiddleware()
            request = RequestFactory().get("/")
            response = HttpResponse("lol")
            response["Content-Type"] = "text/html"
            response["Content-Security-Policy"] = "frame-ancestors test"
            response = middleware.process_response(request, response)
            assert (
                response["Content-Security-Policy"]
                == "frame-ancestors test; default-src *; script-src 'self' *.example.com"
            )

    def test_inject_nonce(self):
        csp_header = (
            "Content-Security-Policy",
            (("default-src", ("*",)), ("script-src", ("'self'", "'nonce-{nonce}'"))),
        )
        with override_settings(CSP_HEADER=csp_header):
            middleware = CspHeaderMiddleware()
            request = RequestFactory().get("/")
            request.csp_nonce = "abcd1234"
            response = HttpResponse("lol")
            response["Content-Type"] = "text/html"
            response = middleware.process_response(request, response)
            assert (
                response["Content-Security-Policy"]
                == "default-src *; script-src 'self' 'nonce-abcd1234'"
            )


class CspReportOnlyHeaderMiddlewareTest(TestCase):
    def test_basic(self):
        csp_header = (
            "Content-Security-Policy-Report-Only",
            (("default-src", ("*",)), ("script-src", ("'self'", "*.example.com"))),
        )
        with override_settings(CSP_REPORT_ONLY=csp_header):
            middleware = CspReportOnlyHeaderMiddleware()
            request = RequestFactory().get("/")
            response = HttpResponse("lol")
            response["Content-Type"] = "text/html"
            response = middleware.process_response(request, response)
            assert (
                response["Content-Security-Policy-Report-Only"]
                == "default-src *; script-src 'self' *.example.com"
            )

            # shouldn't get applied to non-html pages
            response = HttpResponse("lol")
            response["Content-Type"] = "application/json"
            response = middleware.process_response(request, response)
            assert "Content-Security-Policy-Report-Only" not in response

    def test_basic_no_config(self):
        with override_settings(CSP_REPORT_ONLY=None):
            with pytest.raises(MiddlewareNotUsed):
                CspReportOnlyHeaderMiddleware()

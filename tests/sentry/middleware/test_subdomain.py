from __future__ import annotations

from unittest import mock

from django.conf import settings
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.test import RequestFactory, override_settings
from django.urls import re_path, reverse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.middleware.subdomain import SubdomainMiddleware
from sentry.testutils.cases import APITestCase, TestCase


class SubdomainMiddlewareTest(TestCase):
    def test_attaches_subdomain_attribute(self):

        options = {
            "system.base-hostname": "us.dev.getsentry.net:8000",
        }

        def request_with_host(host: str) -> tuple[HttpRequest, HttpResponseBase]:
            got_request = None

            def get_response(request: HttpRequest) -> HttpResponseBase:
                nonlocal got_request
                got_request = request
                return mock.sentinel.response

            subdomain_middleware = SubdomainMiddleware(get_response)
            request = RequestFactory().get("/", HTTP_HOST=host)
            response = subdomain_middleware(request)
            return (request, response)

        def run_request(host: str) -> HttpRequest:
            return request_with_host(host)[0]

        def run_response(host: str) -> HttpResponseBase:
            return request_with_host(host)[1]

        with self.options(options):
            assert run_request("foobar").subdomain is None
            assert run_request("dev.getsentry.net:8000").subdomain is None
            assert run_request("us.dev.getsentry.net:8000").subdomain is None
            assert run_request("foobar.us.dev.getsentry.net:8000").subdomain == "foobar"
            assert run_request("FOOBAR.us.dev.getsentry.net:8000").subdomain == "foobar"
            assert run_request("foo.bar.us.dev.getsentry.net:8000").subdomain == "foo.bar"
            assert run_request("foo.BAR.us.dev.getsentry.net:8000").subdomain == "foo.bar"
            # Invalid subdomain according to RFC 1034/1035.
            assert isinstance(
                run_response("_smtp._tcp.us.dev.getsentry.net:8000"), HttpResponseRedirect
            )

        with self.options({}):
            assert run_request("foobar").subdomain is None
            assert run_request("dev.getsentry.net:8000").subdomain is None
            assert run_request("us.dev.getsentry.net:8000").subdomain is None
            assert run_request("foobar.us.dev.getsentry.net:8000").subdomain is None
            assert run_request("foo.bar.us.dev.getsentry.net:8000").subdomain is None
            assert isinstance(
                run_response("_smtp._tcp.us.dev.getsentry.net:8000"), HttpResponseRedirect
            )


class APITestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        # return HttpResponse(status=status.HTTP_200_OK)
        return Response(
            {
                "subdomain": request.subdomain,
            }
        )


urlpatterns = [
    re_path(
        r"^api/0/test/$",
        APITestEndpoint.as_view(),
        name="test-endpoint",
    ),
]


@override_settings(
    ROOT_URLCONF=__name__,
    SENTRY_SELF_HOSTED=False,
)
class End2EndTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.middleware = settings.MIDDLEWARE

    def test_simple(self):
        self.create_organization(name="albertos-apples")

        response = self.client.get(
            reverse("test-endpoint"),
            HTTP_HOST="albertos-apples.testserver",
        )
        assert response.status_code == 200
        assert response.data == {
            "subdomain": "albertos-apples",
        }

        response = self.client.get(
            reverse("test-endpoint"),
            SERVER_NAME="albertos_apples.testserver",
        )
        assert isinstance(response, HttpResponseRedirect)
        assert response.status_code == 302
        assert response.url == "http://testserver"

from django.conf import settings
from django.conf.urls import url
from django.http import HttpResponseRedirect
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.middleware.subdomain import SubdomainMiddleware
from sentry.testutils import APITestCase, TestCase


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
            assert isinstance(
                request_with_host("_smtp._tcp.us.dev.getsentry.net:8000"), HttpResponseRedirect
            )

        with self.options({}):
            assert request_with_host("foobar").subdomain is None
            assert request_with_host("dev.getsentry.net:8000").subdomain is None
            assert request_with_host("us.dev.getsentry.net:8000").subdomain is None
            assert request_with_host("foobar.us.dev.getsentry.net:8000").subdomain is None
            assert request_with_host("foo.bar.us.dev.getsentry.net:8000").subdomain is None
            assert isinstance(
                request_with_host("_smtp._tcp.us.dev.getsentry.net:8000"), HttpResponseRedirect
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
    url(
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
            follow=True,
        )
        assert response.status_code == 200
        assert response.redirect_chain == [("http://testserver", 302)]

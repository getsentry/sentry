from django.conf import settings
from django.conf.urls import url
from django.test import override_settings
from django.urls import reverse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.auth import superuser
from sentry.testutils import APITestCase
from sudo.settings import COOKIE_NAME as SUDO_COOKIE_NAME


class OrganizationTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request, organization_slug):
        return Response(
            {
                "organization_slug": organization_slug,
            }
        )


urlpatterns = [
    url(
        r"^api/0/(?P<organization_slug>[^\/]+)/$",
        OrganizationTestEndpoint.as_view(),
        name="org-endpoint",
    ),
]


def provision_middleware():
    middleware = list(settings.MIDDLEWARE)
    if "sentry.middleware.dedupe_cookies.DedupeCookiesMiddleware" not in middleware:
        index = middleware.index("sentry.middleware.stats.ResponseCodeMiddleware")
        middleware.insert(index + 1, "sentry.middleware.dedupe_cookies.DedupeCookiesMiddleware")
    return middleware


@override_settings(
    ROOT_URLCONF=__name__,
    SENTRY_SELF_HOSTED=False,
)
class End2EndTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.middleware = provision_middleware()

    def test_relevant_duplicate_cookies(self):
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            headers = {
                "HTTP_COOKIE": f"{settings.SESSION_COOKIE_NAME}=value; foo=bar; {settings.SESSION_COOKIE_NAME}=value2",
            }
            response = self.client.get(
                reverse("org-endpoint", kwargs={"organization_slug": "test"}) + "?foo=bar",
                **headers,
            )

            assert response.status_code == 302
            assert (
                response["Location"]
                == reverse("org-endpoint", kwargs={"organization_slug": "test"}) + "?foo=bar"
            )
            assert (
                response.cookies.output()
                == 'Set-Cookie: sentrysid=""; Domain=.testserver; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/'
            )

    def test_multiple_relevant_duplicate_cookies(self):
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            HTTP_COOKIE = (
                f"{settings.SESSION_COOKIE_NAME}=value; "
                f"{settings.SESSION_COOKIE_NAME}=value2; "
                f"{settings.CSRF_COOKIE_NAME}=value; "
                f"{settings.CSRF_COOKIE_NAME}=value2; "
                f"{superuser.COOKIE_NAME}=value; "
                f"{superuser.COOKIE_NAME}=value2;"
                f"{SUDO_COOKIE_NAME}=value; "
                f"{SUDO_COOKIE_NAME}=value2"
            )
            headers = {
                "HTTP_COOKIE": HTTP_COOKIE,
            }
            response = self.client.get(
                reverse("org-endpoint", kwargs={"organization_slug": "test"}),
                **headers,
            )

            assert response.status_code == 302
            assert response["Location"] == reverse(
                "org-endpoint", kwargs={"organization_slug": "test"}
            )
            set_cookie = response.cookies.output()
            assert (
                'Set-Cookie: sc=""; Domain=.testserver; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/'
                in set_cookie
            )
            assert (
                'Set-Cookie: sentrysid=""; Domain=.testserver; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/'
                in set_cookie
            )
            assert (
                'Set-Cookie: su=""; Domain=.testserver; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/'
                in set_cookie
            )
            assert (
                'Set-Cookie: sudo=""; Domain=.testserver; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/'
                in set_cookie
            )

    def test_irrelevant_duplicate_cookies(self):
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            headers = {
                "HTTP_COOKIE": "bar=value; foo=bar; bar=value2",
            }
            response = self.client.get(
                reverse("org-endpoint", kwargs={"organization_slug": "test"}),
                **headers,
            )

            assert response.status_code == 200
            assert response.cookies.output() == ""

    def test_good_cookies(self):
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            HTTP_COOKIE = (
                f"{settings.SESSION_COOKIE_NAME}=value; "
                f"{settings.CSRF_COOKIE_NAME}=value; "
                f"{superuser.COOKIE_NAME}=value; "
                f"{SUDO_COOKIE_NAME}=value"
            )
            headers = {"HTTP_COOKIE": HTTP_COOKIE}
            response = self.client.get(
                reverse("org-endpoint", kwargs={"organization_slug": "test"}),
                **headers,
            )

            assert response.status_code == 200

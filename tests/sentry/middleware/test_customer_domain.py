from __future__ import annotations

from unittest import mock

from django.conf import settings
from django.contrib.sessions.backends.base import SessionBase
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import re_path, reverse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.middleware.customer_domain import CustomerDomainMiddleware
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import all_silo_test, create_test_regions, no_silo_test
from sentry.web.frontend.auth_logout import AuthLogoutView


def _session(d: dict[str, str]) -> SessionBase:
    ret = SessionBase()
    ret.update(d)
    return ret


@all_silo_test(regions=create_test_regions("us", "eu"))
class CustomerDomainMiddlewareTest(TestCase):
    @with_feature("system:multi-region")
    def test_sets_active_organization_if_exists(self):
        self.create_organization(name="test")

        request = RequestFactory().get("/")
        request.subdomain = "test"
        request.session = _session({"activeorg": "albertos-apples"})
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert dict(request.session) == {"activeorg": "test"}
        assert response == mock.sentinel.response

    def test_noop_if_customer_domain_is_off(self):
        with self.feature({"system:multi-region": False}):
            self.create_organization(name="test")

            request = RequestFactory().get("/")
            request.subdomain = "test"
            request.session = _session({"activeorg": "albertos-apples"})
            response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

            assert dict(request.session) == {"activeorg": "albertos-apples"}
            assert response == mock.sentinel.response

    @with_feature("system:multi-region")
    def test_recycles_last_active_org(self):
        self.create_organization(name="test")

        request = RequestFactory().get("/organizations/test/issues/")
        request.subdomain = "does-not-exist"
        request.session = _session({"activeorg": "test"})
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert dict(request.session) == {"activeorg": "test"}
        assert response.status_code == 302
        assert response["Location"] == "http://test.testserver/organizations/test/issues/"

    @with_feature("system:multi-region")
    def test_recycles_last_active_org_path_mismatch(self):
        self.create_organization(name="test")

        request = RequestFactory().get("/organizations/albertos-apples/issues/")
        request.subdomain = "does-not-exist"
        request.session = _session({"activeorg": "test"})
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert dict(request.session) == {"activeorg": "test"}
        assert response.status_code == 302
        assert response["Location"] == "http://test.testserver/organizations/test/issues/"

    @with_feature("system:multi-region")
    def test_removes_active_organization(self):
        request = RequestFactory().get("/")
        request.subdomain = "does-not-exist"
        request.session = _session({"activeorg": "test"})
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert dict(request.session) == {}
        assert response == mock.sentinel.response

    @with_feature("system:multi-region")
    def test_no_session_dict(self):
        request = RequestFactory().get("/")
        request.subdomain = "test"
        CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert not hasattr(request, "session")

        self.create_organization(name="test")
        request = RequestFactory().get("/")
        request.subdomain = "test"
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert not hasattr(request, "session")
        assert response == mock.sentinel.response

    @with_feature("system:multi-region")
    def test_no_subdomain(self):
        request = RequestFactory().get("/")
        request.session = _session({"activeorg": "test"})
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert dict(request.session) == {"activeorg": "test"}
        assert response == mock.sentinel.response

    @with_feature("system:multi-region")
    def test_no_activeorg(self):
        request = RequestFactory().get("/")
        request.session = _session({})
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert dict(request.session) == {}
        assert response == mock.sentinel.response

    @with_feature("system:multi-region")
    def test_no_op(self):
        request = RequestFactory().get("/")
        response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

        assert not hasattr(request, "session")
        assert not hasattr(request, "subdomain")
        assert response == mock.sentinel.response

    @with_feature("system:multi-region")
    def test_ignores_region_subdomains(self):
        for region_name in ("us", "eu"):
            request = RequestFactory().get("/")
            request.subdomain = region_name
            request.session = _session({"activeorg": "test"})
            response = CustomerDomainMiddleware(lambda request: mock.sentinel.response)(request)

            assert dict(request.session) == {"activeorg": "test"}
            assert response == mock.sentinel.response

    @with_feature("system:multi-region")
    def test_handles_redirects(self):
        self.create_organization(name="sentry")
        request = RequestFactory().get("/organizations/albertos-apples/issues/")
        request.subdomain = "sentry"
        request.session = _session({"activeorg": "test"})

        def ignore_request(request: HttpRequest) -> HttpResponse:
            raise NotImplementedError

        response = CustomerDomainMiddleware(ignore_request)(request)

        assert dict(request.session) == {"activeorg": "sentry"}
        assert response.status_code == 302
        assert response["Location"] == "/organizations/sentry/issues/"

    @with_feature("system:multi-region")
    def test_billing_route(self):
        non_staff_user = self.create_user(is_staff=False)
        self.login_as(user=non_staff_user)
        self.create_organization(name="albertos-apples", owner=non_staff_user)

        response = self.client.get(
            "/settings/billing/checkout/",
            data={"querystring": "value"},
            follow=True,
        )
        assert response.status_code == 200
        assert response.redirect_chain == [
            ("http://albertos-apples.testserver/settings/billing/checkout/?querystring=value", 302)
        ]


class OrganizationTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request, organization_id_or_slug):
        return Response(
            {
                "organization_id_or_slug": organization_id_or_slug,
                "subdomain": request.subdomain,
                "activeorg": request.session.get("activeorg", None),
            }
        )

    def post(self, request, organization_id_or_slug):
        request.session["activeorg"] = organization_id_or_slug
        return Response(
            {
                "organization_id_or_slug": organization_id_or_slug,
                "subdomain": request.subdomain,
                "activeorg": request.session.get("activeorg", None),
            }
        )


class OrganizationIdOrSlugTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request, organization_id_or_slug):
        return Response(
            {
                "organization_id_or_slug": organization_id_or_slug,
                "subdomain": request.subdomain,
                "activeorg": request.session.get("activeorg", None),
            }
        )


urlpatterns = [
    re_path(
        r"^api/0/(?P<organization_id_or_slug>[^\/]+)/$",
        OrganizationTestEndpoint.as_view(),
        name="org-events-endpoint",
    ),
    re_path(
        r"^api/0/(?P<organization_id_or_slug>[^\/]+)/nameless/$",
        OrganizationTestEndpoint.as_view(),
    ),
    re_path(
        r"^api/0/(?P<organization_id_or_slug>[^\/]+)/idorslug/$",
        OrganizationIdOrSlugTestEndpoint.as_view(),
        name="org-events-endpoint-id-or-slug",
    ),
    re_path(r"^logout/$", AuthLogoutView.as_view(), name="sentry-logout"),
]


def provision_middleware():
    middleware = list(settings.MIDDLEWARE)
    if "sentry.middleware.customer_domain.CustomerDomainMiddleware" not in middleware:
        index = middleware.index("sentry.middleware.auth.AuthenticationMiddleware")
        middleware.insert(index + 1, "sentry.middleware.customer_domain.CustomerDomainMiddleware")
    return middleware


@no_silo_test
@override_settings(
    ROOT_URLCONF=__name__,
    SENTRY_SELF_HOSTED=False,
)
class End2EndTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.middleware = provision_middleware()

    @with_feature("system:multi-region")
    def test_with_middleware_no_customer_domain(self):
        self.create_organization(name="albertos-apples")

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            # Induce activeorg session value of a non-existent org
            assert "activeorg" not in self.client.session
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "test"})
            )
            assert response.data == {
                "organization_id_or_slug": "test",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # 'activeorg' session key is not replaced
            response = self.client.get(
                reverse(
                    "org-events-endpoint", kwargs={"organization_id_or_slug": "albertos-apples"}
                )
            )
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # No redirect response
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "some-org"}),
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_id_or_slug": "some-org",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            response = self.client.get(
                reverse("org-events-endpoint-id-or-slug", kwargs={"organization_id_or_slug": 1234}),
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_id_or_slug": "1234",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            response = self.client.get(
                reverse(
                    "org-events-endpoint-id-or-slug", kwargs={"organization_id_or_slug": "some-org"}
                ),
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_id_or_slug": "some-org",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

    @with_feature("system:multi-region")
    def test_with_middleware_and_customer_domain(self):
        self.create_organization(name="albertos-apples")

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            # Induce activeorg session value of a non-existent org
            assert "activeorg" not in self.client.session
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "test"})
            )
            assert response.data == {
                "organization_id_or_slug": "test",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # 'activeorg' session key is replaced
            response = self.client.get(
                reverse(
                    "org-events-endpoint", kwargs={"organization_id_or_slug": "albertos-apples"}
                ),
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # Redirect response for org slug path mismatch
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "some-org"}),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [("/api/0/albertos-apples/?querystring=value", 302)]
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # Redirect response for subdomain and path mismatch
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "some-org"}),
                data={"querystring": "value"},
                HTTP_HOST="does-not-exist.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                ("http://albertos-apples.testserver/api/0/albertos-apples/?querystring=value", 302)
            ]
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # No redirect for http methods that is not GET
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "some-org"}),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []

            # Redirect response for org id or slug path mismatch
            response = self.client.get(
                reverse(
                    "org-events-endpoint-id-or-slug", kwargs={"organization_id_or_slug": "some-org"}
                ),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                ("/api/0/albertos-apples/idorslug/?querystring=value", 302)
            ]
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # No redirect for id
            response = self.client.get(
                reverse("org-events-endpoint-id-or-slug", kwargs={"organization_id_or_slug": 1234}),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []

    @with_feature("system:multi-region")
    def test_with_middleware_and_non_staff(self):
        self.create_organization(name="albertos-apples")
        non_staff_user = self.create_user(is_staff=False)
        self.login_as(user=non_staff_user)

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            # GET request
            response = self.client.get(
                reverse(
                    "org-events-endpoint", kwargs={"organization_id_or_slug": "albertos-apples"}
                ),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # POST request
            response = self.client.post(
                reverse(
                    "org-events-endpoint", kwargs={"organization_id_or_slug": "albertos-apples"}
                ),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.status_code == 200

            # # PUT request (not-supported)
            response = self.client.put(
                reverse(
                    "org-events-endpoint", kwargs={"organization_id_or_slug": "albertos-apples"}
                ),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.status_code == 405

    @with_feature("system:multi-region")
    def test_with_middleware_and_is_staff(self):
        self.create_organization(name="albertos-apples")
        is_staff_user = self.create_user(is_staff=True)
        self.login_as(user=is_staff_user)

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(
                reverse(
                    "org-events-endpoint", kwargs={"organization_id_or_slug": "albertos-apples"}
                ),
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.status_code == 200
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

    @with_feature("system:multi-region")
    def test_without_middleware(self):
        self.create_organization(name="albertos-apples")

        middleware = list(settings.MIDDLEWARE)
        if "sentry.middleware.customer_domain.CustomerDomainMiddleware" in middleware:
            middleware.remove("sentry.middleware.customer_domain.CustomerDomainMiddleware")
        with override_settings(MIDDLEWARE=tuple(middleware)):
            # Induce activeorg session value of a non-existent org
            assert "activeorg" not in self.client.session
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "test"})
            )
            assert response.data == {
                "organization_id_or_slug": "test",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # 'activeorg' session key is not replaced
            response = self.client.get(
                reverse(
                    "org-events-endpoint", kwargs={"organization_id_or_slug": "albertos-apples"}
                ),
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # No redirect response
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_id_or_slug": "some-org"}),
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_id_or_slug": "some-org",
                "subdomain": "albertos-apples",
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

    @with_feature("system:multi-region")
    def test_with_middleware_and_nameless_view(self):
        self.create_organization(name="albertos-apples")

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(
                "/api/0/some-org/nameless/",
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [("/api/0/albertos-apples/nameless/", 302)]
            assert response.data == {
                "organization_id_or_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

    @with_feature("system:multi-region")
    def test_disallowed_customer_domain(self):
        with override_settings(
            MIDDLEWARE=tuple(self.middleware), DISALLOWED_CUSTOMER_DOMAINS=["banned"]
        ):
            response = self.client.get(
                "/api/0/some-org/",
                HTTP_HOST="banned.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [("http://testserver/logout/", 302)]

from django.conf import settings
from django.conf.urls import url
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.middleware.customer_domain import CustomerDomainMiddleware
from sentry.testutils import APITestCase, TestCase
from sentry.testutils.silo import control_silo_test
from sentry.web.frontend.auth_logout import AuthLogoutView


@override_settings(
    SENTRY_USE_CUSTOMER_DOMAINS=True,
)
class CustomerDomainMiddlewareTest(TestCase):
    def test_sets_active_organization_if_exists(self):
        self.create_organization(name="test")

        request = RequestFactory().get("/")
        request.subdomain = "test"
        request.session = {"activeorg": "albertos-apples"}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {"activeorg": "test"}
        assert response == request

    def test_noop_if_customer_domain_is_off(self):

        with self.settings(SENTRY_USE_CUSTOMER_DOMAINS=False):
            self.create_organization(name="test")

            request = RequestFactory().get("/")
            request.subdomain = "test"
            request.session = {"activeorg": "albertos-apples"}
            response = CustomerDomainMiddleware(lambda request: request)(request)

            assert request.session == {"activeorg": "albertos-apples"}
            assert response == request

    def test_recycles_last_active_org(self):
        self.create_organization(name="test")

        request = RequestFactory().get("/organizations/test/issues/")
        request.subdomain = "does-not-exist"
        request.session = {"activeorg": "test"}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {"activeorg": "test"}
        assert response.status_code == 302
        assert response["Location"] == "http://test.testserver/organizations/test/issues/"

    def test_recycles_last_active_org_path_mismatch(self):
        self.create_organization(name="test")

        request = RequestFactory().get("/organizations/albertos-apples/issues/")
        request.subdomain = "does-not-exist"
        request.session = {"activeorg": "test"}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {"activeorg": "test"}
        assert response.status_code == 302
        assert response["Location"] == "http://test.testserver/organizations/test/issues/"

    def test_removes_active_organization(self):
        request = RequestFactory().get("/")
        request.subdomain = "does-not-exist"
        request.session = {"activeorg": "test"}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {}
        assert response == request

    def test_no_session_dict(self):
        request = RequestFactory().get("/")
        request.subdomain = "test"
        CustomerDomainMiddleware(lambda request: request)(request)

        assert "session" not in request

        self.create_organization(name="test")
        request = RequestFactory().get("/")
        request.subdomain = "test"
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert "session" not in request
        assert response == request

    def test_no_subdomain(self):
        request = RequestFactory().get("/")
        request.session = {"activeorg": "test"}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {"activeorg": "test"}
        assert response == request

    def test_no_activeorg(self):
        request = RequestFactory().get("/")
        request.session = {}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {}
        assert response == request

    def test_no_op(self):
        request = RequestFactory().get("/")
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert "session" not in request
        assert "subdomain" not in request
        assert response == request

    def test_ignores_region_subdomains(self):
        regions = {"us", "eu"}
        for region in regions:
            request = RequestFactory().get("/")
            request.subdomain = region
            request.session = {"activeorg": "test"}
            response = CustomerDomainMiddleware(lambda request: request)(request)

            assert request.session == {"activeorg": "test"}
            assert response == request

    def test_handles_redirects(self):
        self.create_organization(name="sentry")
        request = RequestFactory().get("/organizations/albertos-apples/issues/")
        request.subdomain = "sentry"
        request.session = {"activeorg": "test"}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {"activeorg": "sentry"}
        assert response.status_code == 302
        assert response["Location"] == "/organizations/sentry/issues/"


class OrganizationTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request, organization_slug):
        return Response(
            {
                "organization_slug": organization_slug,
                "subdomain": request.subdomain,
                "activeorg": request.session.get("activeorg", None),
            }
        )

    def post(self, request, organization_slug):
        request.session["activeorg"] = organization_slug
        return Response(
            {
                "organization_slug": organization_slug,
                "subdomain": request.subdomain,
                "activeorg": request.session.get("activeorg", None),
            }
        )


urlpatterns = [
    url(
        r"^api/0/(?P<organization_slug>[^\/]+)/$",
        OrganizationTestEndpoint.as_view(),
        name="org-events-endpoint",
    ),
    url(
        r"^api/0/(?P<organization_slug>[^\/]+)/nameless/$",
        OrganizationTestEndpoint.as_view(),
    ),
    url(r"^logout/$", AuthLogoutView.as_view(), name="sentry-logout"),
]


def provision_middleware():
    middleware = list(settings.MIDDLEWARE)
    if "sentry.middleware.customer_domain.CustomerDomainMiddleware" not in middleware:
        index = middleware.index("sentry.middleware.auth.AuthenticationMiddleware")
        middleware.insert(index + 1, "sentry.middleware.customer_domain.CustomerDomainMiddleware")
    return middleware


@override_settings(
    ROOT_URLCONF=__name__,
    SENTRY_SELF_HOSTED=False,
    SENTRY_USE_CUSTOMER_DOMAINS=True,
)
@control_silo_test(stable=True)
class End2EndTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.middleware = provision_middleware()

    def test_with_middleware_no_customer_domain(self):
        self.create_organization(name="albertos-apples")

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            # Induce activeorg session value of a non-existent org
            assert "activeorg" not in self.client.session
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_slug": "test"})
            )
            assert response.data == {
                "organization_slug": "test",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # 'activeorg' session key is not replaced
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "albertos-apples"})
            )
            assert response.data == {
                "organization_slug": "albertos-apples",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # No redirect response
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "some-org"}),
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_slug": "some-org",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

    def test_with_middleware_and_customer_domain(self):
        self.create_organization(name="albertos-apples")

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            # Induce activeorg session value of a non-existent org
            assert "activeorg" not in self.client.session
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_slug": "test"})
            )
            assert response.data == {
                "organization_slug": "test",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # 'activeorg' session key is replaced
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "albertos-apples"}),
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.data == {
                "organization_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # Redirect response for org slug path mismatch
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "some-org"}),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [("/api/0/albertos-apples/?querystring=value", 302)]
            assert response.data == {
                "organization_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # Redirect response for subdomain and path mismatch
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "some-org"}),
                data={"querystring": "value"},
                # This should preferably be HTTP_HOST.
                # Using SERVER_NAME until https://code.djangoproject.com/ticket/32106 is fixed.
                SERVER_NAME="does-not-exist.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                ("http://albertos-apples.testserver/api/0/albertos-apples/?querystring=value", 302)
            ]
            assert response.data == {
                "organization_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # No redirect for http methods that is not GET
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_slug": "some-org"}),
                data={"querystring": "value"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []

    def test_with_middleware_and_non_staff(self):
        self.create_organization(name="albertos-apples")
        non_staff_user = self.create_user(is_staff=False)
        self.login_as(user=non_staff_user)

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            # GET request
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "albertos-apples"}),
                data={"querystring": "value"},
                # This should preferably be HTTP_HOST.
                # Using SERVER_NAME until https://code.djangoproject.com/ticket/32106 is fixed.
                SERVER_NAME="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

            # POST request
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_slug": "albertos-apples"}),
                data={"querystring": "value"},
                SERVER_NAME="albertos-apples.testserver",
            )
            assert response.status_code == 200

            # # PUT request (not-supported)
            response = self.client.put(
                reverse("org-events-endpoint", kwargs={"organization_slug": "albertos-apples"}),
                data={"querystring": "value"},
                SERVER_NAME="albertos-apples.testserver",
            )
            assert response.status_code == 405

    def test_with_middleware_and_is_staff(self):
        self.create_organization(name="albertos-apples")
        is_staff_user = self.create_user(is_staff=True)
        self.login_as(user=is_staff_user)

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "albertos-apples"}),
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.status_code == 200
            assert response.data == {
                "organization_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

    def test_without_middleware(self):
        self.create_organization(name="albertos-apples")

        middleware = list(settings.MIDDLEWARE)
        if "sentry.middleware.customer_domain.CustomerDomainMiddleware" in middleware:
            middleware.remove("sentry.middleware.customer_domain.CustomerDomainMiddleware")
        with override_settings(MIDDLEWARE=tuple(middleware)):
            # Induce activeorg session value of a non-existent org
            assert "activeorg" not in self.client.session
            response = self.client.post(
                reverse("org-events-endpoint", kwargs={"organization_slug": "test"})
            )
            assert response.data == {
                "organization_slug": "test",
                "subdomain": None,
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # 'activeorg' session key is not replaced
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "albertos-apples"}),
                HTTP_HOST="albertos-apples.testserver",
            )
            assert response.data == {
                "organization_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

            # No redirect response
            response = self.client.get(
                reverse("org-events-endpoint", kwargs={"organization_slug": "some-org"}),
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []
            assert response.data == {
                "organization_slug": "some-org",
                "subdomain": "albertos-apples",
                "activeorg": "test",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "test"

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
                "organization_slug": "albertos-apples",
                "subdomain": "albertos-apples",
                "activeorg": "albertos-apples",
            }
            assert "activeorg" in self.client.session
            assert self.client.session["activeorg"] == "albertos-apples"

    def test_disallowed_customer_domain(self):
        with override_settings(
            MIDDLEWARE=tuple(self.middleware), DISALLOWED_CUSTOMER_DOMAINS=["banned"]
        ):
            response = self.client.get(
                "/api/0/some-org/",
                SERVER_NAME="banned.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [("http://testserver/logout/", 302)]

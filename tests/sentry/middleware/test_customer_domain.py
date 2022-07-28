from django.test import RequestFactory

from sentry.middleware.customer_domain import CustomerDomainMiddleware
from sentry.testutils import TestCase


class CustomerDomainMiddlewareTest(TestCase):
    def test_sets_active_organization_if_exists(self):
        self.create_organization(name="test")

        request = RequestFactory().get("/")
        request.subdomain = "test"
        request.session = {"activeorg": "albertos-apples"}
        response = CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {"activeorg": "test"}
        assert response == request

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

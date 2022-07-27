from django.test import RequestFactory

from sentry.middleware.customer_domain import CustomerDomainMiddleware
from sentry.testutils import TestCase


class CustomerDomainMiddlewareTest(TestCase):
    def test_sets_active_organization_if_exists(self):
        self.create_organization(name="test")

        session = {"activeorg": "albertos-apples"}
        request = RequestFactory().get("/")
        request.subdomain = "test"
        request.session = session
        CustomerDomainMiddleware(lambda request: request)(request)

        assert session == {"activeorg": "test"}

    def test_removes_active_organization(self):
        session = {"activeorg": "test"}
        request = RequestFactory().get("/")
        request.subdomain = "does-not-exist"
        request.session = session
        CustomerDomainMiddleware(lambda request: request)(request)

        assert session == {}

    def test_no_session_dict(self):
        request = RequestFactory().get("/")
        request.subdomain = "test"
        CustomerDomainMiddleware(lambda request: request)(request)

        assert "session" not in request

        self.create_organization(name="test")
        request = RequestFactory().get("/")
        request.subdomain = "test"
        CustomerDomainMiddleware(lambda request: request)(request)

        assert "session" not in request

    def test_no_subdomain(self):
        session = {"activeorg": "test"}
        request = RequestFactory().get("/")
        request.session = session
        CustomerDomainMiddleware(lambda request: request)(request)

        assert request.session == {"activeorg": "test"}

    def test_no_op(self):
        request = RequestFactory().get("/")
        CustomerDomainMiddleware(lambda request: request)(request)

        assert "session" not in request
        assert "subdomain" not in request

    def test_ignores_region_subdomains(self):
        regions = {"us", "eu"}
        for region in regions:
            session = {"activeorg": "test"}
            request = RequestFactory().get("/")
            request.subdomain = region
            request.session = session
            CustomerDomainMiddleware(lambda request: request)(request)

            assert request.session == {"activeorg": "test"}

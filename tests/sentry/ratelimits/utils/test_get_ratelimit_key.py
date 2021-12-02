from unittest import TestCase

from django.test import RequestFactory

from sentry.api.endpoints.organization_group_index import OrganizationGroupIndexEndpoint
from sentry.auth.access import Access
from sentry.models import Organization, User
from sentry.ratelimits import get_rate_limit_key


class GetRateLimitKeyTest(TestCase):
    def setUp(self) -> None:
        self.view = OrganizationGroupIndexEndpoint
        self.request = RequestFactory().get("/")

    def test_default_ip(self):
        assert (
            get_rate_limit_key(self.view, self.request)
            == "ip:OrganizationGroupIndexEndpoint:GET:127.0.0.1"
        )

    def test_ip_address_missing(self):
        self.request.META["REMOTE_ADDR"] = None
        assert get_rate_limit_key(self.view, self.request) is None

    def test_ipv6(self):
        self.request.META["REMOTE_ADDR"] = "684D:1111:222:3333:4444:5555:6:77"
        assert (
            get_rate_limit_key(self.view, self.request)
            == "ip:OrganizationGroupIndexEndpoint:GET:684D:1111:222:3333:4444:5555:6:77"
        )

    def test_users(self):
        user = User(id=1)
        self.request.session = {}
        self.request.user = user
        assert (
            get_rate_limit_key(self.view, self.request)
            == f"user:OrganizationGroupIndexEndpoint:GET:{user.id}"
        )

    def test_organization(self):
        organization = Organization(id=1)
        self.request.session = {}
        self.request.user = User(id=1, is_sentry_app=True)
        self.request.access = Access(
            scopes=[],
            is_active=True,
            organization_id=organization.id,
            teams=[],
            projects=[],
            has_global_access=False,
            sso_is_valid=True,
            requires_sso=False,
        )
        assert (
            get_rate_limit_key(self.view, self.request)
            == f"org:OrganizationGroupIndexEndpoint:GET:{organization.id}"
        )

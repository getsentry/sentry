from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory
from rest_framework.permissions import AllowAny

from sentry.api.base import Endpoint
from sentry.api.endpoints.organization_group_index import OrganizationGroupIndexEndpoint
from sentry.auth.system import SystemToken
from sentry.models.apitoken import ApiToken
from sentry.models.user import User
from sentry.ratelimits import get_rate_limit_config, get_rate_limit_key
from sentry.ratelimits.config import RateLimitConfig
from sentry.services.hybrid_cloud.auth import AuthenticatedToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


class GetRateLimitKeyTest(TestCase):
    def setUp(self) -> None:
        self.view = OrganizationGroupIndexEndpoint.as_view()
        self.request = RequestFactory().get("/")
        self.rate_limit_config = get_rate_limit_config(self.view.view_class)
        self.rate_limit_group = (
            self.rate_limit_config.group if self.rate_limit_config else RateLimitConfig().group
        )

    def test_default_ip(self):
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == "ip:default:OrganizationGroupIndexEndpoint:GET:127.0.0.1"
        )

    def test_ip_address_missing(self):
        self.request.META["REMOTE_ADDR"] = None
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            is None
        )

    def test_ipv6(self):
        self.request.META["REMOTE_ADDR"] = "684D:1111:222:3333:4444:5555:6:77"
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == "ip:default:OrganizationGroupIndexEndpoint:GET:684D:1111:222:3333:4444:5555:6:77"
        )

    def test_system_token(self):
        self.request.auth = SystemToken()
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            is None
        )

    def test_users(self):
        user = User(id=1)
        self.request.session = SessionBase()
        self.request.user = user
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:OrganizationGroupIndexEndpoint:GET:{user.id}"
        )

    def test_organization(self):
        self.request.session = SessionBase()
        sentry_app = self.create_sentry_app(
            name="Tesla App", published=True, organization=self.organization
        )
        install = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )

        self.request.user = sentry_app.proxy_user

        self.request.auth = install.api_token

        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"org:default:OrganizationGroupIndexEndpoint:GET:{install.organization_id}"
        )

    def test_api_token(self):
        token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.request.auth = token
        self.request.user = self.user
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:OrganizationGroupIndexEndpoint:GET:{self.user.id}"
        )

    def test_authenticated_token(self):
        # Ensure AuthenticatedToken kinds are registered
        import sentry.services.hybrid_cloud.auth.impl  # noqa: F401

        token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        self.request.auth = AuthenticatedToken.from_token(token)
        self.request.user = self.user
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:OrganizationGroupIndexEndpoint:GET:{self.user.id}"
        )


class DummyEndpoint(Endpoint):
    permission_classes = (AllowAny,)


@region_silo_test
class TestDefaultToGroup(TestCase):
    def setUp(self) -> None:
        self.view = DummyEndpoint.as_view()
        self.request = RequestFactory().get("/")
        self.rate_limit_config = get_rate_limit_config(self.view.view_class)
        self.rate_limit_group = (
            self.rate_limit_config.group if self.rate_limit_config else RateLimitConfig().group
        )

    def test_group_key(self):
        user = User(id=1)
        self.request.session = SessionBase()
        self.request.user = user
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:GET:{user.id}"
        )

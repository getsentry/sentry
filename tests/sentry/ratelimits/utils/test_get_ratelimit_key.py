from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory
from rest_framework.permissions import AllowAny

from sentry.api.base import Endpoint
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.system import SystemToken
from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica
from sentry.models.apitoken import ApiToken
from sentry.ratelimits import get_rate_limit_config, get_rate_limit_key
from sentry.ratelimits.config import RateLimitConfig
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User

CONCURRENT_RATE_LIMIT = 20


class APITestEndpoint(Endpoint):
    permission_classes = (AllowAny,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
                RateLimitCategory.USER: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
                RateLimitCategory.ORGANIZATION: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
            },
        },
    )

    def get(self, request):
        raise NotImplementedError


@all_silo_test
class GetRateLimitKeyTest(TestCase):
    def setUp(self) -> None:
        self.view = APITestEndpoint.as_view()
        self.request = RequestFactory().get("/")
        self.rate_limit_config = get_rate_limit_config(self.view.view_class)
        self.rate_limit_group = (
            self.rate_limit_config.group if self.rate_limit_config else RateLimitConfig().group
        )

    def _populate_public_integration_request(self, request) -> None:
        install = self.create_sentry_app_installation(organization=self.organization)
        token = install.api_token

        with assume_test_silo_mode_of(User):
            request.user = User.objects.get(id=install.sentry_app.proxy_user_id)
            request.auth = AuthenticatedToken.from_token(token)

    def _populate_internal_integration_request(self, request) -> None:
        internal_integration = self.create_internal_integration(
            name="my_app",
            organization=self.organization,
            scopes=("project:read",),
            webhook_url="http://example.com",
        )
        token = self.create_internal_integration_token(
            user=self.user,
            internal_integration=internal_integration,
        )

        with assume_test_silo_mode_of(User):
            request.user = User.objects.get(id=internal_integration.proxy_user_id)
            request.auth = AuthenticatedToken.from_token(token)

    def test_ips(self):
        # Test for default IP
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == "ip:default:APITestEndpoint:GET:127.0.0.1"
        )
        # Test when IP address is missing
        self.request.META["REMOTE_ADDR"] = None
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            is None
        )
        # Test when IP address is IPv6
        self.request.META["REMOTE_ADDR"] = "684D:1111:222:3333:4444:5555:6:77"
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == "ip:default:APITestEndpoint:GET:684D:1111:222:3333:4444:5555:6:77"
        )

    def test_user(self):
        self.request.session = SessionBase()
        self.request.user = self.user

        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:APITestEndpoint:GET:{self.user.id}"
        )

    def test_system_token(self):
        self.request.auth = AuthenticatedToken.from_token(SystemToken())
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            is None
        )

    def test_api_token(self):
        with assume_test_silo_mode_of(ApiToken):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
            self.request.auth = AuthenticatedToken.from_token(token)
        self.request.user = self.user
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:APITestEndpoint:GET:{self.user.id}"
        )

    def test_api_token_replica(self):
        with assume_test_silo_mode_of(ApiToken):
            apitoken = ApiToken.objects.create(
                user=self.user, scope_list=["event:read", "org:read"]
            )
        with assume_test_silo_mode_of(ApiTokenReplica):
            token = ApiTokenReplica.objects.get(apitoken_id=apitoken.id)
        self.request.auth = AuthenticatedToken.from_token(token)
        self.request.user = self.user

        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:APITestEndpoint:GET:{self.user.id}"
        )

    def test_authenticated_token(self):
        with assume_test_silo_mode_of(ApiToken):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
            self.request.auth = AuthenticatedToken.from_token(token)
        self.request.user = self.user
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:APITestEndpoint:GET:{self.user.id}"
        )

    def test_api_key(self):
        self.request.user = AnonymousUser()
        self.request.auth = AuthenticatedToken.from_token(
            self.create_api_key(organization=self.organization, scope_list=["project:write"])
        )

        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == "ip:default:APITestEndpoint:GET:127.0.0.1"
        )

    def test_org_auth_token(self):
        self.request.user = AnonymousUser()
        self.request.auth = AuthenticatedToken.from_token(
            self.create_org_auth_token(organization_id=self.organization.id, scope_list=["org:ci"])
        )

        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == "ip:default:APITestEndpoint:GET:127.0.0.1"
        )

    def test_user_auth_token(self):
        with assume_test_silo_mode_of(User):
            token = self.create_user_auth_token(
                user=self.user, scope_list=["event:read", "org:read"]
            )
            self.request.auth = AuthenticatedToken.from_token(token)
        self.request.user = self.user

        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"user:default:APITestEndpoint:GET:{self.user.id}"
        )

    def test_integration_tokens(self):
        # Test for PUBLIC Integration api tokens
        self._populate_public_integration_request(self.request)
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"org:default:APITestEndpoint:GET:{self.organization.id}"
        )

        # Test for INTERNAL Integration api tokens
        self._populate_internal_integration_request(self.request)
        assert self.request.auth is not None
        with assume_test_silo_mode_of(SentryAppInstallation, SentryAppInstallationToken):
            # Ensure that the internal integration token lives in
            # SentryAppInstallationToken instead of SentryAppInstallation
            assert not SentryAppInstallation.objects.filter(
                api_token_id=self.request.auth.entity_id
            )
            assert SentryAppInstallationToken.objects.filter(
                api_token_id=self.request.auth.entity_id
            )
        assert (
            get_rate_limit_key(
                self.view, self.request, self.rate_limit_group, self.rate_limit_config
            )
            == f"org:default:APITestEndpoint:GET:{self.organization.id}"
        )


class DummyEndpoint(Endpoint):
    permission_classes = (AllowAny,)


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

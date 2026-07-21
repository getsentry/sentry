from functools import cached_property
from unittest.mock import MagicMock, patch

from django.test import RequestFactory, override_settings
from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.auth import AuthenticationMiddleware
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.seer import agent_token
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.users.models.userip import UserIP
from sentry.users.services.user.service import user_service
from sentry.utils import jwt
from sentry.utils.auth import login


@all_silo_test
class AuthenticationMiddlewareTestCase(TestCase):
    middleware = cached_property(AuthenticationMiddleware)

    def assert_user_equals(self, request):
        assert request.user == user_service.get_user(user_id=self.user.id)

    @cached_property
    def request(self):
        rv = RequestFactory().get("/")
        rv.session = self.session
        return rv

    def test_process_request_anon(self) -> None:
        request = Request(self.request)
        self.middleware.process_request(request)
        assert request.user.is_anonymous
        assert request.auth is None

    def test_process_request_user(self) -> None:
        request = Request(self.request)
        with assume_test_silo_mode(SiloMode.MONOLITH):
            assert login(request, self.user)
        with outbox_runner():
            self.middleware.process_request(request)
            # Force the user object to materialize
            request.user.id

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.refresh_from_db()
            assert UserIP.objects.filter(user_id=self.user.id, ip_address="127.0.0.1").exists()

        assert request.user.is_authenticated
        self.assert_user_equals(request)
        assert "_nonce" not in request.session

    def test_process_request_good_nonce(self) -> None:
        request = Request(self.request)
        user = self.user
        user.session_nonce = "xxx"
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.save()
            assert login(request, user)
        self.middleware.process_request(request)
        assert request.user.is_authenticated
        self.assert_user_equals(request)
        assert request.session["_nonce"] == "xxx"

    def test_process_request_missing_nonce(self) -> None:
        request = Request(self.request)
        user = self.user
        user.session_nonce = "xxx"
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.save()
            assert login(request, user)
        del request.session["_nonce"]
        self.middleware.process_request(request)
        assert request.user.is_anonymous

    def test_process_request_bad_nonce(self) -> None:
        request = self.request
        user = self.user
        user.session_nonce = "xxx"
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.save()
            assert login(request, user)
        request.session["_nonce"] = "gtfo"
        self.middleware.process_request(request)
        assert request.user.is_anonymous

    def test_process_request_valid_authtoken(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["event:read", "org:read"])
        request = Request(self.make_request(method="GET"))
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {token.token}"
        self.middleware.process_request(request)
        self.assert_user_equals(request)
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuthenticatedToken.from_token(request.auth) == AuthenticatedToken.from_token(
                token
            )

    def test_process_request_invalid_authtoken(self) -> None:
        request = Request(self.make_request(method="GET"))
        request.META["HTTP_AUTHORIZATION"] = "Bearer absadadafdf"
        self.middleware.process_request(request)
        # Should swallow errors and pass on
        assert request.user.is_anonymous
        assert request.auth is None

    def _agent_token(self, user) -> str:
        token, _ = agent_token.encode_agent_token(
            user_id=user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="s1",
        )
        return token

    def test_process_request_valid_agent_token(self) -> None:
        # The agent is a non-user actor: the request user stays anonymous; the credential
        # records the delegating user and org.
        with (
            override_settings(SEER_API_SHARED_SECRET="test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            request = Request(self.make_request(method="GET", path="/api/0/organizations/"))
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {self._agent_token(self.user)}"
            self.middleware.process_request(request)
        assert request.user.is_anonymous
        assert request.auth is not None
        assert request.auth.kind == agent_token.AGENT_TOKEN_KIND
        assert request.auth.user_id == self.user.id
        assert request.auth.organization_id == self.organization.id

    def test_process_request_invalid_agent_token(self) -> None:
        request = Request(self.make_request(method="GET", path="/api/0/organizations/"))
        invalid_token = jwt.encode(
            {"aud": agent_token.AGENT_TOKEN_AUDIENCE},
            "wrong-secret",
            headers={"typ": agent_token.AGENT_TOKEN_TYPE},
        )
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {invalid_token}"
        with (
            override_settings(SEER_API_SHARED_SECRET="test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            self.middleware.process_request(request)
        # Swallowed like any other bad credential; DRF delivers the real 401 later.
        assert request.user.is_anonymous
        assert request.auth is None

    def test_process_request_agent_token_never_becomes_a_user(self) -> None:
        # Even on a non-API path, the agent authenticates as a non-user actor: the request
        # user is anonymous, so user-only web views fail closed. (No path gate needed.)
        with (
            override_settings(SEER_API_SHARED_SECRET="test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            request = Request(self.make_request(method="GET", path="/organizations/"))
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {self._agent_token(self.user)}"
            self.middleware.process_request(request)
        assert request.user.is_anonymous
        assert request.auth is not None
        assert request.auth.user_id == self.user.id

    def test_process_request_agent_token_wins_over_session(self) -> None:
        # An Authorization header takes precedence over a session cookie: the agent bearer
        # is processed and the session user is not adopted. The agent stays a non-user actor.
        request = Request(self.make_request(method="GET", path="/api/0/organizations/"))
        with assume_test_silo_mode(SiloMode.MONOLITH):
            assert login(request, self.user)
        with (
            override_settings(SEER_API_SHARED_SECRET="test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {self._agent_token(self.user)}"
            self.middleware.process_request(request)
        assert request.user.is_anonymous
        assert request.auth is not None
        assert request.auth.user_id == self.user.id

    def test_process_request_valid_apikey(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            apikey = ApiKey.objects.create(
                organization_id=self.organization.id, allowed_origins="*"
            )
            request = Request(self.make_request(method="GET"))
            request.META["HTTP_AUTHORIZATION"] = self.create_basic_auth_header(apikey.key)

        self.middleware.process_request(request)
        # ApiKey is tied to an organization not user
        assert request.user.is_anonymous
        assert AuthenticatedToken.from_token(request.auth) == AuthenticatedToken.from_token(apikey)

    def test_process_request_invalid_apikey(self) -> None:
        request = Request(self.make_request(method="GET"))
        request.META["HTTP_AUTHORIZATION"] = b"Basic adfasdfasdfsadfsaf"

        self.middleware.process_request(request)
        # Should swallow errors and pass on
        assert request.user.is_anonymous
        assert request.auth is None

    def test_process_request_rpc_path_ignored(self) -> None:
        request = Request(
            self.make_request(
                method="GET", path="/api/0/internal/rpc/organization/get_organization_by_id"
            )
        )
        request.META["HTTP_AUTHORIZATION"] = b"Rpcsignature not-a-checksum"

        self.middleware.process_request(request)
        # No errors, and no user identified.
        assert request.user.is_anonymous
        assert request.auth is None

    @patch("sentry.users.models.userip.geo_by_addr")
    def test_process_request_log_userip(self, mock_geo_by_addr: MagicMock) -> None:
        mock_geo_by_addr.return_value = {
            "country_code": "US",
            "region": "CA",
            "subdivision": "San Francisco",
        }
        request = Request(self.request)
        request.META["REMOTE_ADDR"] = "8.8.8.8"
        with assume_test_silo_mode(SiloMode.MONOLITH):
            assert login(request, self.user)

        with outbox_runner():
            self.middleware.process_request(request)
            # Should be logged in and have logged a UserIp record.
            assert request.user.id == self.user.id
            assert mock_geo_by_addr.call_count == 1

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserIP.objects.count() > 0
            userip = UserIP.objects.get(user_id=self.user.id)
        assert userip.ip_address == "8.8.8.8"
        assert userip.country_code == "US"
        assert userip.region_code == "CA"

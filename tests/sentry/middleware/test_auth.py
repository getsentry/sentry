from datetime import UTC, datetime, timedelta
from functools import cached_property
from time import time
from typing import Any
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.backends.signed_cookies import SessionStore
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from rest_framework.request import Request

from sentry.auth.principal import acting_user_id
from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.auth import (
    SESSION_RENEWED_AT_KEY,
    AuthenticationMiddleware,
    get_session_renew_interval,
)
from sentry.models.apikey import ApiKey
from sentry.models.apitoken import ApiToken
from sentry.seer import agent_token
from sentry.service_accounts.auth import is_service_account_auth
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import (
    all_silo_test,
    assume_test_silo_mode,
    cell_silo_test,
    control_silo_test,
)
from sentry.users.models.user import User
from sentry.users.models.userip import UserIP
from sentry.users.services.user.service import user_service
from sentry.utils import jwt
from sentry.utils.auth import login
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


@all_silo_test
class AuthenticationMiddlewareTestCase(TestCase):
    middleware = cached_property(AuthenticationMiddleware)

    def assert_user_equals(self, request: HttpRequest) -> None:
        assert request.user == user_service.get_user(user_id=self.user.id)

    @cached_property
    def request(self) -> Any:
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
            acting_user_id(request.user)

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

    def _agent_token(self, user: User) -> str:
        token, _ = agent_token.encode_agent_token(
            user_id=user.id,
            organization_id=self.organization.id,
            scopes=["org:read"],
            session_id="s1",
        )
        return token

    def test_process_request_valid_agent_token(self) -> None:
        with (
            override_settings(SEER_API_SHARED_SECRET="test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            request = Request(self.make_request(method="GET", path="/api/0/organizations/"))
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {self._agent_token(self.user)}"
            self.middleware.process_request(request)
        assert request.user.is_authenticated
        assert acting_user_id(request.user) == self.user.id
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

    def test_process_request_agent_token_supplies_compatibility_user_on_non_api_path(self) -> None:
        with (
            override_settings(SEER_API_SHARED_SECRET="test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            request = Request(self.make_request(method="GET", path="/organizations/"))
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {self._agent_token(self.user)}"
            self.middleware.process_request(request)
        assert request.user.is_authenticated
        assert acting_user_id(request.user) == self.user.id
        assert request.auth is not None
        assert request.auth.user_id == self.user.id

    def test_process_request_agent_token_wins_over_session(self) -> None:
        session_user = self.create_user()
        request = Request(self.make_request(method="GET", path="/api/0/organizations/"))
        with assume_test_silo_mode(SiloMode.MONOLITH):
            assert login(request, session_user)
        with (
            override_settings(SEER_API_SHARED_SECRET="test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {self._agent_token(self.user)}"
            self.middleware.process_request(request)
        assert request.user.is_authenticated
        assert acting_user_id(request.user) == self.user.id
        assert acting_user_id(request.user) != session_user.id
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
            assert acting_user_id(request.user) == self.user.id
            assert mock_geo_by_addr.call_count == 1

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert UserIP.objects.count() > 0
            userip = UserIP.objects.get(user_id=self.user.id)
        assert userip.ip_address == "8.8.8.8"
        assert userip.country_code == "US"
        assert userip.region_code == "CA"


@cell_silo_test
class ServiceAccountAuthenticationMiddlewareTest(TestCase):
    SHARED_SECRET = "a-long-secret-key"

    @override_settings(SEER_API_SHARED_SECRET=SHARED_SECRET)
    @with_feature("organizations:service-accounts")
    def test_service_account_stays_off_the_django_request(self) -> None:
        service_account = self.create_service_account(organization=self.organization)
        context = ViewerContext(
            actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
            organization_id=self.organization.id,
        )
        request: Any = self.make_request(method="GET")
        request.META["HTTP_X_VIEWER_CONTEXT"] = encode_viewer_context(
            context, key=self.SHARED_SECRET
        )

        AuthenticationMiddleware(lambda r: r).process_request(request)

        # Only DRF puts the account on request.user, so Django views never treat it as logged in.
        assert request.user.is_anonymous
        assert is_service_account_auth(request.auth)


@all_silo_test
class RenewSessionTest(TestCase):
    middleware = cached_property(AuthenticationMiddleware)

    def make_session_request(self) -> Any:
        request = RequestFactory().get("/")
        request.session = self.session
        # Organization endpoints set the organization
        request.organization = self.organization
        return request

    def sign_in(self, request: Any) -> None:
        with assume_test_silo_mode(SiloMode.MONOLITH):
            assert login(request, self.user)
        request.session.modified = False

    def handle(self, request: Any, response: HttpResponse | None = None) -> None:
        self.middleware.process_request(request)
        # A view resolves the user
        acting_user_id(request.user)
        self.middleware.process_response(request, response or HttpResponse())

    def test_does_not_renew_by_default(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)

        self.handle(request)

        assert SESSION_RENEWED_AT_KEY not in request.session
        assert not request.session.modified

    @with_feature("organizations:sliding-session-expiry")
    def test_renews_session(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)

        self.handle(request)

        assert request.session[SESSION_RENEWED_AT_KEY] == int(time())
        assert request.session.modified

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_renew_recently_renewed_session(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)
        renewed_at = int(time()) - get_session_renew_interval() + 60
        request.session[SESSION_RENEWED_AT_KEY] = renewed_at
        request.session.modified = False

        self.handle(request)

        assert request.session[SESSION_RENEWED_AT_KEY] == renewed_at
        assert not request.session.modified

    @with_feature("organizations:sliding-session-expiry")
    def test_renews_session_after_interval(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)
        request.session[SESSION_RENEWED_AT_KEY] = int(time()) - get_session_renew_interval() - 60
        request.session.modified = False

        self.handle(request)

        assert request.session[SESSION_RENEWED_AT_KEY] == int(time())
        assert request.session.modified

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_renew_without_organization(self) -> None:
        request = self.make_session_request()
        del request.organization
        self.sign_in(request)

        self.handle(request)

        assert SESSION_RENEWED_AT_KEY not in request.session
        assert not request.session.modified

    def test_does_not_renew_for_organization_without_feature(self) -> None:
        other_organization = self.create_organization()
        request = self.make_session_request()
        self.sign_in(request)

        with self.feature({"organizations:sliding-session-expiry": [other_organization.slug]}):
            self.handle(request)

        assert SESSION_RENEWED_AT_KEY not in request.session
        assert not request.session.modified

    def test_renew_interval(self) -> None:
        assert get_session_renew_interval() == 24 * 60 * 60

        # A session that lasts less than two days is renewed halfway through
        with override_settings(SESSION_COOKIE_AGE=60 * 60):
            assert get_session_renew_interval() == 30 * 60

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_renew_anonymous_session(self) -> None:
        request = self.make_session_request()

        self.handle(request)

        assert request.user.is_anonymous
        assert list(request.session.keys()) == []

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_start_session_for_token(self) -> None:
        token = self.create_user_auth_token(self.user)
        request: Any = RequestFactory().get("/", HTTP_AUTHORIZATION=f"Bearer {token.token}")
        request.session = SessionStore()
        request.organization = self.organization

        self.handle(request)

        assert request.user.is_authenticated
        assert not request.session.accessed
        assert not request.session.modified

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_use_session_when_user_is_not_resolved(self) -> None:
        request: Any = RequestFactory().get("/")
        request.session = SessionStore()
        request.organization = self.organization

        self.middleware.process_request(request)
        self.middleware.process_response(request, HttpResponse())

        assert not request.session.accessed

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_renew_session_that_was_signed_out(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)

        self.middleware.process_request(request)
        acting_user_id(request.user)
        # Signing out flushes the session
        request.session.flush()
        self.middleware.process_response(request, HttpResponse())

        assert SESSION_KEY not in request.session
        assert SESSION_RENEWED_AT_KEY not in request.session

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_renew_session_with_invalid_nonce(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.refresh_session_nonce()
            self.user.save()

        self.handle(request)

        assert request.user.is_anonymous
        assert SESSION_RENEWED_AT_KEY not in request.session
        assert not request.session.modified

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_renew_on_server_error(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)

        self.handle(request, HttpResponse(status=500))

        assert SESSION_RENEWED_AT_KEY not in request.session
        assert not request.session.modified

    @with_feature("organizations:sliding-session-expiry")
    def test_does_not_renew_on_cacheable_response(self) -> None:
        request = self.make_session_request()
        self.sign_in(request)

        self.handle(request, HttpResponse(headers={"Cache-Control": "max-age=3600"}))

        assert SESSION_RENEWED_AT_KEY not in request.session
        assert not request.session.modified


class SlidingSessionTestMixin:
    signed_in_at = datetime(2024, 1, 1, tzinfo=UTC)

    def is_signed_in(self, after: timedelta) -> bool:
        raise NotImplementedError

    def test_session_ends_after_cookie_age_by_default(self) -> None:
        assert self.is_signed_in(after=timedelta(days=13))
        # Being active on day 13 doesn't keep the session past day 14
        assert not self.is_signed_in(after=timedelta(days=15))

    @with_feature("organizations:sliding-session-expiry")
    def test_active_session_is_renewed(self) -> None:
        assert self.is_signed_in(after=timedelta(days=13))
        assert self.is_signed_in(after=timedelta(days=20))
        assert self.is_signed_in(after=timedelta(days=33))

    @with_feature("organizations:sliding-session-expiry")
    def test_inactive_session_ends(self) -> None:
        assert self.is_signed_in(after=timedelta(days=1))
        # Last active on day 1, so the session ends on day 15
        assert not self.is_signed_in(after=timedelta(days=16))


@control_silo_test
class SlidingSessionTest(SlidingSessionTestMixin, APITestCase):
    endpoint = "sentry-api-0-organization-api-key-index"

    def setUp(self) -> None:
        super().setUp()
        with freeze_time(self.signed_in_at):
            self.login_as(self.user)
        # The first request saves the organization in the session
        assert self.is_signed_in(after=timedelta())

    def is_signed_in(self, after: timedelta) -> bool:
        with freeze_time(self.signed_in_at + after):
            return self.get_response(self.organization.slug).status_code == 200

    @with_feature("organizations:sliding-session-expiry")
    def test_session_cookie_is_set_once_per_interval(self) -> None:
        with freeze_time(self.signed_in_at + timedelta(days=2)):
            response = self.get_success_response(self.organization.slug)
        assert response.cookies[settings.SESSION_COOKIE_NAME]["max-age"] == (
            settings.SESSION_COOKIE_AGE
        )

        with freeze_time(self.signed_in_at + timedelta(days=2, hours=1)):
            response = self.get_success_response(self.organization.slug)
        assert settings.SESSION_COOKIE_NAME not in response.cookies

        with freeze_time(self.signed_in_at + timedelta(days=3, hours=1)):
            response = self.get_success_response(self.organization.slug)
        assert settings.SESSION_COOKIE_NAME in response.cookies

    def test_session_cookie_is_not_set_by_default(self) -> None:
        with freeze_time(self.signed_in_at + timedelta(days=2)):
            response = self.get_success_response(self.organization.slug)

        assert settings.SESSION_COOKIE_NAME not in response.cookies


@cell_silo_test
class CellSlidingSessionTest(SlidingSessionTestMixin, APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def setUp(self) -> None:
        super().setUp()
        with freeze_time(self.signed_in_at):
            self.login_as(self.user)
        # The first request saves the organization in the session
        assert self.is_signed_in(after=timedelta())

    def is_signed_in(self, after: timedelta) -> bool:
        with freeze_time(self.signed_in_at + after):
            return self.get_response(self.organization.slug).status_code == 200

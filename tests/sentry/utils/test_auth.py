from datetime import datetime, timedelta, timezone
from time import time

from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.base import SessionBase
from django.http import HttpRequest
from django.urls import reverse

import sentry.utils.auth
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.utils.auth import (
    EmailAuthBackend,
    SsoSession,
    construct_link_with_query,
    get_login_redirect,
    login,
    mark_sso_complete,
)


@control_silo_test
class EmailAuthBackendTest(TestCase):
    def setUp(self) -> None:
        self.user = User(username="foo", email="baz@example.com")
        self.user.set_password("bar")
        self.user.save()

    @property
    def backend(self):
        return EmailAuthBackend()

    def test_can_authenticate_with_username(self) -> None:
        result = self.backend.authenticate(HttpRequest(), username="foo", password="bar")
        self.assertEqual(result, self.user)

    def test_can_authenticate_with_username_case_insensitive(self) -> None:
        result = self.backend.authenticate(HttpRequest(), username="FOO", password="bar")
        self.assertEqual(result, self.user)

    def test_can_authenticate_with_email(self) -> None:
        result = self.backend.authenticate(
            HttpRequest(), username="baz@example.com", password="bar"
        )
        self.assertEqual(result, self.user)

    def test_can_authenticate_with_email_case_insensitive(self) -> None:
        result = self.backend.authenticate(
            HttpRequest(), username="BAZ@example.com", password="bar"
        )
        self.assertEqual(result, self.user)

    def test_does_not_authenticate_with_invalid_password(self) -> None:
        result = self.backend.authenticate(HttpRequest(), username="foo", password="pizza")
        self.assertEqual(result, None)


@control_silo_test
class GetLoginRedirectTest(TestCase):
    def _make_request(self, next=None):
        request = HttpRequest()
        request.META["SERVER_NAME"] = "testserver"
        request.META["SERVER_PORT"] = "80"
        request.session = SessionBase()
        request.user = self.user
        if next:
            request.session["_next"] = next
        return request

    def test_schema_uses_default(self) -> None:
        result = get_login_redirect(self._make_request("http://example.com"))
        assert result == reverse("sentry-login")

        result = get_login_redirect(self._make_request("ftp://testserver"))
        assert result == reverse("sentry-login")

    def test_next(self) -> None:
        result = get_login_redirect(self._make_request("http://testserver/foobar/"))
        assert result == "http://testserver/foobar/"

        result = get_login_redirect(self._make_request("ftp://testserver/foobar/"))
        assert result == reverse("sentry-login")

        request = self._make_request("/foobar/")
        request.subdomain = "orgslug"
        result = get_login_redirect(request)
        assert result == "http://orgslug.testserver/foobar/"

        request = self._make_request("http://testserver/foobar/")
        request.subdomain = "orgslug"
        result = get_login_redirect(request)
        assert result == "http://testserver/foobar/"

        request = self._make_request("ftp://testserver/foobar/")
        request.subdomain = "orgslug"
        result = get_login_redirect(request)
        assert result == f"http://orgslug.testserver{reverse('sentry-login')}"

    def test_after_2fa(self) -> None:
        request = self._make_request()
        request.session["_after_2fa"] = "http://testserver/foobar/"
        result = get_login_redirect(request)
        assert result == "http://testserver/foobar/"

        request = self._make_request()
        request.subdomain = "orgslug"
        request.session["_after_2fa"] = "/foobar/"
        result = get_login_redirect(request)
        assert result == "http://orgslug.testserver/foobar/"

    def test_pending_2fa(self) -> None:
        request = self._make_request()
        request.session["_pending_2fa"] = [1234, 1234, 1234]
        result = get_login_redirect(request)
        assert result == reverse("sentry-2fa-dialog")

        request = self._make_request()
        request.subdomain = "orgslug"
        request.session["_pending_2fa"] = [1234, 1234, 1234]
        result = get_login_redirect(request)
        assert result == f"http://orgslug.testserver{reverse('sentry-2fa-dialog')}"

    def test_login_uses_default(self) -> None:
        result = get_login_redirect(self._make_request(reverse("sentry-login")))
        assert result == reverse("sentry-login")

    def test_no_value_uses_default(self) -> None:
        result = get_login_redirect(self._make_request())
        assert result == reverse("sentry-login")

        request = self._make_request()
        request.subdomain = "orgslug"
        result = get_login_redirect(request)
        assert result == f"http://orgslug.testserver{reverse('sentry-login')}"


@control_silo_test
class LoginTest(TestCase):
    def _make_request(self):
        request = HttpRequest()
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        request.session = self.session
        request.user = AnonymousUser()
        return request

    def test_simple(self) -> None:
        request = self._make_request()
        assert login(request, self.user)
        assert request.user == self.user
        assert "_nonce" not in request.session

    def test_with_organization(self) -> None:
        org = self.create_organization(name="foo", owner=self.user)
        request = self._make_request()
        assert login(request, self.user, organization_id=org.id)
        assert request.user == self.user
        assert f"{SsoSession.SSO_SESSION_KEY}:{org.id}" in request.session

    def test_with_nonce(self) -> None:
        self.user.refresh_session_nonce()
        self.user.save()
        assert self.user.session_nonce is not None
        request = self._make_request()
        assert login(request, self.user)
        assert request.user == self.user
        assert request.session["_nonce"] == self.user.session_nonce


def test_sso_expiry_default() -> None:
    value = sentry.utils.auth._sso_expiry_from_env(None)
    # make sure no accidental changes affect sso timeout
    assert value == timedelta(days=7)


def test_sso_expiry_from_env() -> None:
    value = sentry.utils.auth._sso_expiry_from_env("20")
    assert value == timedelta(seconds=20)


def test_construct_link_with_query() -> None:
    # testing basic query param construction
    path = "foobar"
    query_params = {"biz": "baz"}
    expected_path = "foobar?biz=baz"

    assert construct_link_with_query(path=path, query_params=query_params) == expected_path

    # testing no excess '?' appended if query params are empty
    path = "foobar"
    query_params = {}
    expected_path = "foobar"

    assert construct_link_with_query(path=path, query_params=query_params) == expected_path


class SsoSessionTest(TestCase):
    def test_to_dict_without_session_not_on_or_after(self) -> None:
        sso_session = SsoSession.create(organization_id=123)
        result = sso_session.to_dict()

        assert SsoSession.SSO_LOGIN_TIMESTAMP in result
        assert SsoSession.SSO_SESSION_NOT_ON_OR_AFTER not in result

    def test_to_dict_with_session_not_on_or_after(self) -> None:
        expiry_timestamp = int(time()) + 3600  # 1 hour from now
        sso_session = SsoSession.create(
            organization_id=123, session_not_on_or_after=expiry_timestamp
        )
        result = sso_session.to_dict()

        assert SsoSession.SSO_LOGIN_TIMESTAMP in result
        assert result[SsoSession.SSO_SESSION_NOT_ON_OR_AFTER] == expiry_timestamp

    def test_from_django_session_value_without_session_not_on_or_after(self) -> None:
        # Backward compatibility: old session format without snoa
        session_value = {SsoSession.SSO_LOGIN_TIMESTAMP: time()}
        sso_session = SsoSession.from_django_session_value(123, session_value)

        assert sso_session.organization_id == 123
        assert sso_session.session_not_on_or_after is None

    def test_from_django_session_value_with_session_not_on_or_after(self) -> None:
        expiry_timestamp = int(time()) + 3600
        session_value = {
            SsoSession.SSO_LOGIN_TIMESTAMP: time(),
            SsoSession.SSO_SESSION_NOT_ON_OR_AFTER: expiry_timestamp,
        }
        sso_session = SsoSession.from_django_session_value(123, session_value)

        assert sso_session.organization_id == 123
        assert sso_session.session_not_on_or_after == expiry_timestamp

    def test_is_sso_authtime_fresh_without_provider_expiry(self) -> None:
        # Default behavior: check against SSO_EXPIRY_TIME
        sso_session = SsoSession.create(organization_id=123)
        assert sso_session.is_sso_authtime_fresh() is True

        # Create session with old auth time
        old_time = datetime.now(tz=timezone.utc) - timedelta(days=8)
        old_session = SsoSession(organization_id=123, time=old_time)
        assert old_session.is_sso_authtime_fresh() is False

    def test_is_sso_authtime_fresh_with_provider_expiry_not_expired(self) -> None:
        # Provider-specified expiry in the future
        future_expiry = int(time()) + 3600  # 1 hour from now
        sso_session = SsoSession.create(organization_id=123, session_not_on_or_after=future_expiry)
        assert sso_session.is_sso_authtime_fresh() is True

    def test_is_sso_authtime_fresh_with_provider_expiry_expired(self) -> None:
        # Provider-specified expiry in the past
        past_expiry = int(time()) - 60  # 1 minute ago
        sso_session = SsoSession.create(organization_id=123, session_not_on_or_after=past_expiry)
        assert sso_session.is_sso_authtime_fresh() is False

    def test_provider_expiry_takes_precedence_over_default(self) -> None:
        # Even if authenticated recently, if provider expiry is past, session is not fresh
        past_expiry = int(time()) - 60  # 1 minute ago
        sso_session = SsoSession(
            organization_id=123,
            time=datetime.now(tz=timezone.utc),  # Just authenticated
            session_not_on_or_after=past_expiry,
        )
        assert sso_session.is_sso_authtime_fresh() is False


@control_silo_test
class MarkSsoCompleteTest(TestCase):
    def _make_request(self):
        request = HttpRequest()
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        request.session = self.session
        return request

    def test_mark_sso_complete_without_session_expiry(self) -> None:
        org = self.create_organization(name="foo", owner=self.user)
        request = self._make_request()

        mark_sso_complete(request, org.id)

        session_key = SsoSession.django_session_key(org.id)
        assert session_key in request.session
        assert SsoSession.SSO_LOGIN_TIMESTAMP in request.session[session_key]
        assert SsoSession.SSO_SESSION_NOT_ON_OR_AFTER not in request.session[session_key]

    def test_mark_sso_complete_with_session_expiry(self) -> None:
        org = self.create_organization(name="foo", owner=self.user)
        request = self._make_request()
        expiry_timestamp = int(time()) + 3600

        mark_sso_complete(request, org.id, session_not_on_or_after=expiry_timestamp)

        session_key = SsoSession.django_session_key(org.id)
        assert session_key in request.session
        assert SsoSession.SSO_LOGIN_TIMESTAMP in request.session[session_key]
        assert (
            request.session[session_key][SsoSession.SSO_SESSION_NOT_ON_OR_AFTER] == expiry_timestamp
        )

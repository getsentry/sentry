from __future__ import absolute_import

import six

from datetime import timedelta
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.utils import timezone
from sentry.utils.compat.mock import Mock, patch

from sentry.auth.superuser import (
    COOKIE_DOMAIN,
    COOKIE_HTTPONLY,
    COOKIE_NAME,
    COOKIE_PATH,
    COOKIE_SALT,
    COOKIE_SECURE,
    IDLE_MAX_AGE,
    MAX_AGE,
    SESSION_KEY,
    Superuser,
    is_active_superuser,
)
from sentry.auth.system import SystemToken
from sentry.middleware.superuser import SuperuserMiddleware
from sentry.models import User
from sentry.testutils import TestCase
from sentry.utils.auth import mark_sso_complete

UNSET = object()


class SuperuserTestCase(TestCase):
    def setUp(self):
        super(SuperuserTestCase, self).setUp()
        self.current_datetime = timezone.now()
        self.default_token = "abcdefghjiklmnog"

    def build_request(
        self,
        cookie_token=UNSET,
        session_token=UNSET,
        expires=UNSET,
        idle_expires=UNSET,
        uid=UNSET,
        session_data=True,
        user=None,
    ):
        if user is None:
            user = self.create_user("foo@example.com", is_superuser=True)
        current_datetime = self.current_datetime
        request = self.make_request(user=user)
        if cookie_token is not None:
            request.COOKIES[COOKIE_NAME] = signing.get_cookie_signer(
                salt=COOKIE_NAME + COOKIE_SALT
            ).sign(self.default_token if cookie_token is UNSET else cookie_token)
        if session_data:
            request.session[SESSION_KEY] = {
                "exp": (
                    current_datetime + timedelta(hours=6) if expires is UNSET else expires
                ).strftime("%s"),
                "idl": (
                    current_datetime + timedelta(minutes=15)
                    if idle_expires is UNSET
                    else idle_expires
                ).strftime("%s"),
                "tok": self.default_token if session_token is UNSET else session_token,
                "uid": six.text_type(user.id) if uid is UNSET else uid,
            }
        return request

    def test_ips(self):
        user = User(is_superuser=True)
        request = self.make_request(user=user)
        request.META["REMOTE_ADDR"] = "10.0.0.1"

        # no ips = any host
        superuser = Superuser(request, allowed_ips=())
        superuser.set_logged_in(request.user)
        assert superuser.is_active is True

        superuser = Superuser(request, allowed_ips=("127.0.0.1",))
        superuser.set_logged_in(request.user)
        assert superuser.is_active is False

        superuser = Superuser(request, allowed_ips=("10.0.0.1",))
        superuser.set_logged_in(request.user)
        assert superuser.is_active is True

    def test_sso(self):
        user = User(is_superuser=True)
        request = self.make_request(user=user)

        # no ips = any host
        superuser = Superuser(request, org_id=None)
        superuser.set_logged_in(request.user)
        assert superuser.is_active is True

        superuser = Superuser(request, org_id=1)
        superuser.set_logged_in(request.user)
        assert superuser.is_active is False

        mark_sso_complete(request, 1)
        superuser = Superuser(request, org_id=1)
        superuser.set_logged_in(request.user)
        assert superuser.is_active is True

    def test_valid_data(self):
        request = self.build_request()
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is True

    def test_missing_cookie(self):
        request = self.build_request(cookie_token=None)
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    def test_invalid_cookie_token(self):
        request = self.build_request(cookie_token="foobar")
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    def test_invalid_session_token(self):
        request = self.build_request(session_token="foobar")
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    def test_missing_data(self):
        request = self.build_request(session_data=False)
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    def test_invalid_uid(self):
        request = self.build_request(uid=-1)
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    def test_expired(self):
        request = self.build_request(expires=self.current_datetime)
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    def test_idle_expired(self):
        request = self.build_request(idle_expires=self.current_datetime)
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    def test_login_saves_session(self):
        user = self.create_user("foo@example.com", is_superuser=True)
        request = self.make_request()
        superuser = Superuser(request, allowed_ips=(), current_datetime=self.current_datetime)
        superuser.set_logged_in(user, current_datetime=self.current_datetime)

        # request.user wasn't set
        assert not superuser.is_active

        request.user = user
        assert superuser.is_active

        data = request.session.get(SESSION_KEY)
        assert data
        assert data["exp"] == (self.current_datetime + MAX_AGE).strftime("%s")
        assert data["idl"] == (self.current_datetime + IDLE_MAX_AGE).strftime("%s")
        assert len(data["tok"]) == 12
        assert data["uid"] == six.text_type(user.id)

    def test_logout_clears_session(self):
        request = self.build_request()
        superuser = Superuser(request, allowed_ips=(), current_datetime=self.current_datetime)
        superuser.set_logged_out()

        assert not superuser.is_active
        assert not request.session.get(SESSION_KEY)

    def test_middleware_as_superuser(self):
        request = self.build_request()

        delattr(request, "superuser")
        delattr(request, "is_superuser")

        middleware = SuperuserMiddleware()
        middleware.process_request(request)
        assert request.superuser.is_active
        assert request.is_superuser()

        response = Mock()
        middleware.process_response(request, response)
        response.set_signed_cookie.assert_called_once_with(
            COOKIE_NAME,
            request.superuser.token,
            salt=COOKIE_SALT,
            max_age=None,
            secure=request.is_secure() if COOKIE_SECURE is None else COOKIE_SECURE,
            httponly=COOKIE_HTTPONLY,
            path=COOKIE_PATH,
            domain=COOKIE_DOMAIN,
        )

    def test_changed_user(self):
        request = self.build_request()
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active

        # anonymous
        request.user = AnonymousUser()
        assert not superuser.is_active

        # a non-superuser
        request.user = self.create_user("baz@example.com")
        assert not superuser.is_active

        # a superuser
        request.user.update(is_superuser=True)
        assert not superuser.is_active

    def test_is_active_superuser_sys_token(self):
        request = self.build_request()
        request.auth = SystemToken()
        assert is_active_superuser(request)

    def test_is_active_superuser(self):
        request = self.build_request()
        request.superuser = Superuser(request, allowed_ips=())
        request.superuser._is_active = True
        assert is_active_superuser(request)

    def test_is_not_active_superuser(self):
        request = self.build_request()
        request.superuser = Superuser(request, allowed_ips=())
        request.superuser._is_active = False
        assert not is_active_superuser(request)

    @patch.object(Superuser, "is_active", return_value=True)
    def test_is_active_superuser_from_request(self, _mock_is_active):
        request = self.build_request()
        request.superuser = None
        assert is_active_superuser(request)

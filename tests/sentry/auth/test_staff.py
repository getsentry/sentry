from contextlib import contextmanager
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.utils import timezone

from sentry.auth import staff
from sentry.auth.staff import (
    COOKIE_DOMAIN,
    COOKIE_HTTPONLY,
    COOKIE_NAME,
    COOKIE_PATH,
    COOKIE_SALT,
    COOKIE_SECURE,
    IDLE_MAX_STAFF_SESSION_AGE,
    MAX_STAFF_SESSION_AGE,
    SESSION_KEY,
    Staff,
    is_active_staff,
)
from sentry.auth.system import SystemToken
from sentry.middleware.placeholder import placeholder_get_response
from sentry.middleware.staff import StaffMiddleware
from sentry.models.user import User
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.utils.auth import mark_sso_complete

UNSET = object()

BASETIME = datetime(2022, 3, 21, 0, 0, tzinfo=timezone.utc)

EXPIRE_TIME = timedelta(hours=4, minutes=1)

INSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME = timedelta(minutes=14)

IDLE_EXPIRE_TIME = OUTSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME = timedelta(hours=2)


@contextmanager
def override_org_id(new_org_id: int):
    """
    ORG_ID in staff.py is loaded from STAFF_ORG_ID in settings. This happens at
    the module level, but we cannot override module level variables using
    Django's built-in override_settings, so we need this context manager.
    """
    old_org_id = staff.ORG_ID
    staff.ORG_ID = new_org_id
    try:
        yield
    finally:
        staff.ORG_ID = old_org_id


@control_silo_test
@freeze_time(BASETIME)
class StaffTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.current_datetime = timezone.now()
        self.default_token = "abcdefghijklmnog"

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
            user = self.user
        request = self.make_request(user=user)
        if cookie_token is not None:
            request.COOKIES[COOKIE_NAME] = signing.get_cookie_signer(
                salt=COOKIE_NAME + COOKIE_SALT
            ).sign(self.default_token if cookie_token is UNSET else cookie_token)
        if session_data:
            request.session[SESSION_KEY] = {
                "exp": (
                    self.current_datetime + timedelta(hours=4) if expires is UNSET else expires
                ).strftime("%s"),
                "idl": (
                    self.current_datetime + timedelta(minutes=15)
                    if idle_expires is UNSET
                    else idle_expires
                ).strftime("%s"),
                "tok": self.default_token if session_token is UNSET else session_token,
                "uid": str(user.id) if uid is UNSET else uid,
            }
        return request

    def test_ips(self):
        user = User(is_staff=True)
        request = self.make_request(user=user)
        request.META["REMOTE_ADDR"] = "10.0.0.1"

        # no ips = any host
        staff = Staff(request, allowed_ips=())
        staff.set_logged_in(request.user)
        assert staff.is_active is True

        staff = Staff(request, allowed_ips=("127.0.0.1",))
        staff.set_logged_in(request.user)
        assert staff.is_active is False

        staff = Staff(request, allowed_ips=("10.0.0.1",))
        staff.set_logged_in(request.user)
        assert staff.is_active is True

    def test_sso(self):
        user = User(is_staff=True)
        request = self.make_request(user=user)

        # no ips = any host
        staff = Staff(request)
        staff.set_logged_in(request.user)
        assert staff.is_active is True

        # Set ORG_ID so we run the SSO check
        with override_org_id(new_org_id=self.organization.id):
            staff = Staff(request)
            staff.set_logged_in(request.user)
            assert staff.is_active is False

            mark_sso_complete(request, self.organization.id)
            staff = Staff(request)
            staff.set_logged_in(request.user)
            assert staff.is_active is True

    def test_valid_data(self):
        request = self.build_request()
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is True

    def test_missing_cookie(self):
        request = self.build_request(cookie_token=None)
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is False

    def test_invalid_cookie_token(self):
        request = self.build_request(cookie_token="foobar")
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is False

    def test_invalid_session_token(self):
        request = self.build_request(session_token="foobar")
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is False

    def test_missing_data(self):
        request = self.build_request(session_data=False)
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is False

    def test_invalid_uid(self):
        request = self.build_request(uid=-1)
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is False

    @freeze_time(BASETIME + EXPIRE_TIME)
    def test_expired(self):
        # Set idle time to the current time so we fail on checking expire time
        # and not idle time.
        request = self.build_request(
            idle_expires=BASETIME + EXPIRE_TIME, expires=self.current_datetime
        )
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is False

    @freeze_time(BASETIME + IDLE_EXPIRE_TIME)
    def test_idle_expired(self):
        request = self.build_request(idle_expires=self.current_datetime)
        staff = Staff(request, allowed_ips=())
        assert staff.is_active is False

    def test_login_saves_session(self):
        user = self.create_user("foo@example.com")
        request = self.make_request()
        staff = Staff(request, allowed_ips=(), current_datetime=self.current_datetime)
        staff.set_logged_in(user, current_datetime=self.current_datetime)

        # request.user wasn't set
        assert not staff.is_active

        request.user = user
        assert staff.is_active

        data = request.session.get(SESSION_KEY)
        assert data
        assert data["exp"] == (self.current_datetime + MAX_STAFF_SESSION_AGE).strftime("%s")
        assert data["idl"] == (self.current_datetime + IDLE_MAX_STAFF_SESSION_AGE).strftime("%s")
        assert len(data["tok"]) == 12
        assert data["uid"] == str(user.id)

    def test_logout_clears_session(self):
        request = self.build_request()
        staff = Staff(request, allowed_ips=(), current_datetime=self.current_datetime)
        staff.set_logged_out()

        assert not staff.is_active
        assert not request.session.get(SESSION_KEY)

    def test_middleware_as_staff(self):
        request = self.build_request()

        delattr(request, "staff")

        middleware = StaffMiddleware(placeholder_get_response)
        middleware.process_request(request)
        assert request.staff.is_active
        assert is_active_staff(request)

        response = Mock()
        middleware.process_response(request, response)
        response.set_signed_cookie.assert_called_once_with(
            COOKIE_NAME,
            request.staff.token,
            salt=COOKIE_SALT,
            max_age=None,
            secure=request.is_secure() if COOKIE_SECURE is None else COOKIE_SECURE,
            httponly=COOKIE_HTTPONLY,
            path=COOKIE_PATH,
            domain=COOKIE_DOMAIN,
        )

    def test_middleware_as_staff_without_session(self):
        request = self.build_request(session_data=False)

        delattr(request, "staff")

        middleware = StaffMiddleware(placeholder_get_response)
        middleware.process_request(request)
        assert not request.staff.is_active
        assert not is_active_staff(request)

        response = Mock()
        middleware.process_response(request, response)
        response.delete_cookie.assert_called_once_with(COOKIE_NAME)

    def test_middleware_as_non_staff(self):
        user = self.create_user("foo@example.com", is_staff=False)
        request = self.build_request(user=user)

        delattr(request, "staff")

        middleware = StaffMiddleware(placeholder_get_response)
        middleware.process_request(request)
        assert not request.staff.is_active
        assert not is_active_staff(request)

        response = Mock()
        middleware.process_response(request, response)
        assert not response.set_signed_cookie.called

    def test_changed_user(self):
        request = self.build_request()
        staff = Staff(request, allowed_ips=())
        assert staff.is_active

        # anonymous
        request.user = AnonymousUser()
        assert not staff.is_active

        # a non-staff
        request.user = self.create_user("baz@example.com", is_staff=False)
        assert not staff.is_active

        # a staff
        request.user.update(is_staff=True)
        assert not staff.is_active

    def test_is_active_staff_sys_token(self):
        request = self.build_request()
        request.auth = SystemToken()
        assert is_active_staff(request)

    def test_is_active_staff(self):
        request = self.build_request()
        request.staff = Staff(request, allowed_ips=())
        request.staff._is_active = True
        assert is_active_staff(request)

    def test_is_not_active_staff(self):
        request = self.build_request()
        request.staff = Staff(request, allowed_ips=())
        request.staff._is_active = False
        assert not is_active_staff(request)

    @patch.object(Staff, "is_active", return_value=True)
    def test_is_active_staff_from_request(self, mock_is_active):
        request = self.build_request()
        request.staff = None
        assert is_active_staff(request)

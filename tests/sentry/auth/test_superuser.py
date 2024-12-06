from datetime import UTC, datetime, timedelta
from unittest import mock
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.test import override_settings
from django.utils import timezone

from sentry.auth.services.auth.model import RpcAuthState, RpcMemberSsoState
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
    SUPERUSER_READONLY_SCOPES,
    SUPERUSER_SCOPES,
    Superuser,
    SuperuserAccessFormInvalidJson,
    SuperuserAccessSerializer,
    get_superuser_scopes,
    is_active_superuser,
    superuser_has_permission,
)
from sentry.auth.system import SystemToken
from sentry.middleware.placeholder import placeholder_get_response
from sentry.middleware.superuser import SuperuserMiddleware
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.auth import mark_sso_complete

UNSET = object()

BASETIME = datetime(2022, 3, 21, 0, 0, tzinfo=UTC)

EXPIRE_TIME = timedelta(hours=4, minutes=1)

INSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME = timedelta(minutes=14)

IDLE_EXPIRE_TIME = OUTSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME = timedelta(hours=2)


@control_silo_test
@freeze_time(BASETIME)
class SuperuserTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.current_datetime = timezone.now()
        self.default_token = "abcdefghjiklmnog"
        self.superuser = self.create_user(is_superuser=True)

    def build_request(
        self,
        cookie_token=UNSET,
        session_token=UNSET,
        expires=UNSET,
        idle_expires=UNSET,
        uid=UNSET,
        session_data=True,
        user=None,
        method="get",
    ):
        if user is None:
            user = self.superuser
        current_datetime = self.current_datetime
        request = self.make_request(user=user, method=method)
        if cookie_token is not None:
            request.COOKIES[COOKIE_NAME] = signing.get_cookie_signer(
                salt=COOKIE_NAME + COOKIE_SALT
            ).sign(self.default_token if cookie_token is UNSET else cookie_token)
        if session_data:
            request.session[SESSION_KEY] = {
                "exp": (
                    current_datetime + timedelta(hours=4) if expires is UNSET else expires
                ).strftime("%s"),
                "idl": (
                    current_datetime + timedelta(minutes=15)
                    if idle_expires is UNSET
                    else idle_expires
                ).strftime("%s"),
                "tok": self.default_token if session_token is UNSET else session_token,
                "uid": str(user.id) if uid is UNSET else uid,
            }
        return request

    def test_ips(self):
        request = self.make_request(user=self.superuser)
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
        request = self.make_request(user=self.superuser)

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

    @freeze_time(BASETIME + EXPIRE_TIME)
    def test_expired(self):
        # Set idle time to the current time so we fail on checking expire time
        # and not idle time.
        request = self.build_request(
            idle_expires=BASETIME + EXPIRE_TIME, expires=self.current_datetime
        )
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    @freeze_time(BASETIME + IDLE_EXPIRE_TIME)
    def test_idle_expired(self):
        request = self.build_request(idle_expires=self.current_datetime)
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is False

    @override_settings(SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True)
    @mock.patch("sentry.auth.superuser.logger")
    def test_su_access_logs(self, logger):
        request = self.make_request(user=self.superuser, method="PUT")
        request._body = json.dumps(
            {
                "superuserAccessCategory": "for_unit_test",
                "superuserReason": "Edit organization settings",
                "isSuperuserModal": True,
            }
        ).encode()

        superuser = Superuser(request, org_id=None)
        superuser.set_logged_in(request.user)
        assert superuser.is_active is True
        assert logger.info.call_count == 3
        logger.info.assert_any_call(
            "superuser.superuser_access",
            extra={
                "superuser_token_id": superuser.token,
                "user_id": self.superuser.id,
                "user_email": self.superuser.email,
                "su_access_category": "for_unit_test",
                "reason_for_su": "Edit organization settings",
            },
        )

    @override_settings(SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True)
    def test_su_access_no_request(self):
        request = self.make_request(user=self.superuser, method="PUT")

        superuser = Superuser(request, org_id=None)

        with pytest.raises(SuperuserAccessFormInvalidJson):
            superuser.set_logged_in(request.user)
            assert superuser.is_active is False

    @freeze_time(BASETIME + OUTSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME)
    def test_not_expired_check_org_in_request(self):
        request = self.build_request()
        request.session[SESSION_KEY]["idl"] = (
            self.current_datetime + OUTSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME + timedelta(minutes=15)
        ).strftime("%s")
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active is True
        assert not getattr(request, "organization", None)

    @freeze_time(BASETIME + INSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME)
    def test_max_time_org_change_within_time(self):
        request = self.build_request()
        request.organization = self.create_organization(name="not_our_org")
        superuser = Superuser(request, allowed_ips=())

        assert superuser.is_active is True

    @freeze_time(BASETIME + OUTSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME)
    @mock.patch("sentry.auth.superuser.logger")
    def test_max_time_org_change_time_expired(self, logger):
        request = self.build_request()
        request.session[SESSION_KEY]["idl"] = (
            self.current_datetime + OUTSIDE_PRIVILEGE_ACCESS_EXPIRE_TIME + timedelta(minutes=15)
        ).strftime("%s")
        request.organization = self.create_organization(name="not_our_org")
        superuser = Superuser(request, allowed_ips=())

        assert superuser.is_active is False
        logger.warning.assert_any_call(
            "superuser.privileged_org_access_expired",
            extra={"superuser_token": "abcdefghjiklmnog"},
        )

    @override_settings(SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True)
    @mock.patch("sentry.auth.superuser.logger")
    def test_su_access_no_request_user_missing_info(self, logger):
        request = self.make_request(user=self.superuser, method="PUT")
        request._body = json.dumps(
            {
                "superuserAccessCategory": "for_unit_test",
                "superuserReason": "Edit organization settings",
            }
        ).encode()
        del request.user.id

        superuser = Superuser(request, org_id=None)

        superuser.set_logged_in(request.user)
        logger.exception.assert_any_call("superuser.superuser_access.missing_user_info")

    @override_settings(SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True)
    def test_su_access_invalid_request_body(
        self,
    ):
        request = self.make_request(user=self.superuser, method="PUT")
        request._body = b'{"invalid" "json"}'

        superuser = Superuser(request, org_id=None)

        with pytest.raises(SuperuserAccessFormInvalidJson):
            superuser.set_logged_in(request.user)
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

        # See mypy issue: https://github.com/python/mypy/issues/9457
        data = request.session.get(SESSION_KEY)  # type:ignore[unreachable]
        assert data
        assert data["exp"] == (self.current_datetime + MAX_AGE).strftime("%s")
        assert data["idl"] == (self.current_datetime + IDLE_MAX_AGE).strftime("%s")
        assert len(data["tok"]) == 12
        assert data["uid"] == str(user.id)

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

        middleware = SuperuserMiddleware(placeholder_get_response)
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

    def test_middleware_as_superuser_without_session(self):
        request = self.build_request(session_data=False)

        delattr(request, "superuser")
        delattr(request, "is_superuser")

        middleware = SuperuserMiddleware(placeholder_get_response)
        middleware.process_request(request)
        assert not request.superuser.is_active
        assert not request.is_superuser()

        response = Mock()
        middleware.process_response(request, response)
        response.delete_cookie.assert_called_once_with(COOKIE_NAME)

    def test_middleware_as_non_superuser(self):
        user = self.create_user("foo@example.com", is_superuser=False)
        request = self.build_request(user=user)

        delattr(request, "superuser")
        delattr(request, "is_superuser")

        middleware = SuperuserMiddleware(placeholder_get_response)
        middleware.process_request(request)
        assert not request.superuser.is_active
        assert not request.is_superuser()

        response = Mock()
        middleware.process_response(request, response)
        assert not response.set_signed_cookie.called

    def test_changed_user(self):
        request = self.build_request()
        superuser = Superuser(request, allowed_ips=())
        assert superuser.is_active

        # anonymous
        request.user = AnonymousUser()
        assert not superuser.is_active

        # a non-superuser
        # See mypy issue: https://github.com/python/mypy/issues/9457
        request.user = self.create_user("baz@example.com")  # type:ignore[unreachable]
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

    @mock.patch("sentry.auth.superuser.logger")
    def test_superuser_session_doesnt_need_validation_superuser_prompts(self, logger):
        request = self.make_request(user=self.superuser, method="PUT")
        superuser = Superuser(request, org_id=None)
        superuser.set_logged_in(request.user)
        assert superuser.is_active is True
        assert logger.info.call_count == 2
        logger.info.assert_any_call(
            "superuser.logged-in",
            extra={"ip_address": "127.0.0.1", "user_id": self.superuser.id},
        )

    def test_superuser_invalid_serializer(self):
        serialized_data = SuperuserAccessSerializer(data={})
        assert serialized_data.is_valid() is False
        assert (
            json.dumps(serialized_data.errors)
            == '{"superuserAccessCategory":["This field is required."],"superuserReason":["This field is required."]}'
        )

        serialized_data = SuperuserAccessSerializer(
            data={
                "superuserAccessCategory": "for_unit_test",
            }
        )
        assert serialized_data.is_valid() is False
        assert (
            json.dumps(serialized_data.errors) == '{"superuserReason":["This field is required."]}'
        )

        serialized_data = SuperuserAccessSerializer(
            data={
                "superuserReason": "Edit organization settings",
            }
        )
        assert serialized_data.is_valid() is False
        assert (
            json.dumps(serialized_data.errors)
            == '{"superuserAccessCategory":["This field is required."]}'
        )

        serialized_data = SuperuserAccessSerializer(
            data={
                "superuserAccessCategory": "for_unit_test",
                "superuserReason": "Eds",
            }
        )
        assert serialized_data.is_valid() is False
        assert (
            json.dumps(serialized_data.errors)
            == '{"superuserReason":["Ensure this field has at least 4 characters."]}'
        )

        serialized_data = SuperuserAccessSerializer(
            data={
                "superuserAccessCategory": "for_unit_test",
                "superuserReason": "128 max chars 128 max chars 128 max chars 128 max chars 128 max chars 128 max chars 128 max chars 128 max chars 128 max chars 128 max chars ",
            }
        )
        assert serialized_data.is_valid() is False
        assert (
            json.dumps(serialized_data.errors)
            == '{"superuserReason":["Ensure this field has no more than 128 characters."]}'
        )

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_scopes(self):
        user = self.create_user(is_superuser=True)

        auth_state = RpcAuthState(sso_state=RpcMemberSsoState(), permissions=[])
        auth_state_with_write = RpcAuthState(
            sso_state=RpcMemberSsoState(), permissions=["superuser.write"]
        )

        assert (
            get_superuser_scopes(auth_state, user, organization_context=self.organization)
            == SUPERUSER_SCOPES
        )
        assert (
            get_superuser_scopes(
                auth_state_with_write, user, organization_context=self.organization
            )
            == SUPERUSER_SCOPES
        )

        # test scope separation
        with self.options({"superuser.read-write.ga-rollout": True}):
            assert (
                get_superuser_scopes(auth_state, user, organization_context=self.organization)
                == SUPERUSER_READONLY_SCOPES
            )
            assert (
                get_superuser_scopes(
                    auth_state_with_write, user, organization_context=self.organization
                )
                == SUPERUSER_SCOPES
            )

    def test_superuser_scopes_self_hosted(self):
        # self hosted always has superuser write scopes

        user = self.create_user(is_superuser=True)

        auth_state = RpcAuthState(sso_state=RpcMemberSsoState(), permissions=[])
        auth_state_with_write = RpcAuthState(
            sso_state=RpcMemberSsoState(), permissions=["superuser.write"]
        )

        assert (
            get_superuser_scopes(auth_state, user, organization_context=self.organization)
            == SUPERUSER_SCOPES
        )
        assert (
            get_superuser_scopes(
                auth_state_with_write, user, organization_context=self.organization
            )
            == SUPERUSER_SCOPES
        )

        with self.feature({"superuser.read-write.ga-rollout": True}):
            assert (
                get_superuser_scopes(auth_state, user, organization_context=self.organization)
                == SUPERUSER_SCOPES
            )
            assert (
                get_superuser_scopes(
                    auth_state_with_write, user, organization_context=self.organization
                )
                == SUPERUSER_SCOPES
            )

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_superuser_has_permission(self):
        request = self.build_request()

        assert not superuser_has_permission(request)

        # logging in gives permission
        request.superuser = Superuser(request)
        request.superuser._is_active = True
        assert superuser_has_permission(request)

    def test_superuser_has_permission_self_hosted(self):
        request = self.build_request()

        request.superuser = Superuser(request)
        request.superuser._is_active = True

        assert superuser_has_permission(request)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_has_permission_read_write_get(self):
        request = self.build_request(method="GET")

        request.superuser = Superuser(request)
        request.superuser._is_active = True

        # all superusers have permission to hit GET
        request.access = self.create_request_access()
        assert superuser_has_permission(request)

        request.access = self.create_request_access(permissions=["superuser.write"])
        assert superuser_has_permission(request)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_has_permission_read_write_post(self):
        request = self.build_request(method="POST")

        request.superuser = Superuser(request)
        request.superuser._is_active = True

        # superuser without superuser.write does not have permission
        request.access = self.create_request_access()
        assert not superuser_has_permission(request)

        # superuser with superuser.write has permission
        request.access = self.create_request_access(permissions=["superuser.write"])
        assert superuser_has_permission(request)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_has_permission_read_write_no_request_access(self):
        request = self.build_request(method="GET")

        request.superuser = Superuser(request)
        request.superuser._is_active = True

        # no request.access and no permissions passed in
        with pytest.raises(AssertionError):
            superuser_has_permission(request)

        # no request.access with permissions passed in
        # all superusers have permission for GET
        assert superuser_has_permission(request, frozenset())
        assert superuser_has_permission(request, frozenset(["superuser.write"]))

        request.method = "POST"

        # no request.access and no permissions passed in
        with pytest.raises(AssertionError):
            superuser_has_permission(request)

        # no request.access with permissions passed in
        # only superuser write has permissions for POST
        assert not superuser_has_permission(request, frozenset())
        assert superuser_has_permission(request, frozenset(["superuser.write"]))

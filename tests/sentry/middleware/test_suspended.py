from __future__ import annotations

from functools import cached_property
from unittest.mock import MagicMock, patch, sentinel

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, override_settings
from django.urls import re_path
from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.middleware.auth import get_user
from sentry.middleware.suspended import SuspendedUserMiddleware
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import no_silo_test
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.utils.auth import EmailAuthBackend


class SuspendedUserMiddlewareUnitTest(TestCase):
    middleware = SuspendedUserMiddleware(lambda request: sentinel.response)

    @cached_property
    def factory(self):
        return RequestFactory()

    def _make_request(self, path="/test/", method="GET"):
        factory_method = getattr(self.factory, method.lower(), self.factory.get)
        return factory_method(path)

    def _make_mock_user(self, *, is_suspended=False):
        mock_user = MagicMock()
        mock_user.is_authenticated = True
        mock_user.is_suspended = is_suspended
        mock_user.id = self.user.id
        return mock_user

    def _make_suspended_request(self, path="/test/", method="GET"):
        request = self._make_request(path, method)
        request.user = self._make_mock_user(is_suspended=True)
        return request

    def test_anonymous_user_passes_through(self):
        request = self._make_request()
        request.user = AnonymousUser()
        result = self.middleware.process_request(request)
        assert result is None

    def test_no_user_attribute_passes_through(self):
        request = self._make_request()
        assert not hasattr(request, "user")
        result = self.middleware.process_request(request)
        assert result is None

    def test_authenticated_non_suspended_user_passes_through(self):
        request = self._make_request()
        request.user = self._make_mock_user(is_suspended=False)
        result = self.middleware.process_request(request)
        assert result is None

    def test_suspended_user_blocked_api_path(self):
        request = self._make_suspended_request(path="/api/0/organizations/")
        result = self.middleware.process_request(request)
        assert result is not None
        assert result.status_code == 403
        body = json.loads(result.content)
        assert body == {"detail": "Your account has been suspended."}

    def test_suspended_user_blocked_web_path(self):
        request = self._make_suspended_request(path="/organizations/foo/")
        result = self.middleware.process_request(request)
        assert result is not None
        assert result.status_code == 403
        assert result.content == b"Your account has been suspended."

    def test_exempt_path_reactivate(self):
        request = self._make_suspended_request(path="/auth/reactivate/")
        result = self.middleware.process_request(request)
        assert result is None

    def test_exempt_path_login(self):
        request = self._make_suspended_request(path="/auth/login/")
        result = self.middleware.process_request(request)
        assert result is None

    def test_exempt_path_logout(self):
        request = self._make_suspended_request(path="/auth/logout/")
        result = self.middleware.process_request(request)
        assert result is None

    def test_exempt_path_api_auth_login(self):
        request = self._make_suspended_request(path="/api/0/auth/login/")
        result = self.middleware.process_request(request)
        assert result is None

    def test_api_auth_delete_exempt(self):
        request = self._make_suspended_request(path="/api/0/auth/", method="DELETE")
        result = self.middleware.process_request(request)
        assert result is None

    def test_api_auth_get_blocked(self):
        request = self._make_suspended_request(path="/api/0/auth/")
        result = self.middleware.process_request(request)
        assert result is not None
        assert result.status_code == 403

    def test_api_auth_put_blocked(self):
        request = self._make_suspended_request(path="/api/0/auth/", method="PUT")
        result = self.middleware.process_request(request)
        assert result is not None
        assert result.status_code == 403

    def test_exempt_path_prefix_match(self):
        request = self._make_suspended_request(path="/auth/login/sso/")
        result = self.middleware.process_request(request)
        assert result is None

    @patch("sentry.middleware.suspended.logger")
    def test_logger_error_called(self, mock_logger):
        request = self._make_suspended_request(path="/api/0/organizations/")
        self.middleware.process_request(request)

        mock_logger.error.assert_called_once_with(
            "suspended_user.safety_net_triggered",
            extra={
                "user_id": self.user.id,
                "path": "/api/0/organizations/",
                "method": "GET",
                "ip_address": "127.0.0.1",
            },
        )


class SuspendedTestEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response({"ok": True})


urlpatterns = [
    re_path(
        r"^api/0/suspended-test/$",
        SuspendedTestEndpoint.as_view(),
        name="suspended-test-endpoint",
    ),
]


class LeakyAuthMiddleware(MiddlewareMixin):
    """Simulates a new auth class that authenticates suspended users without checking is_suspended."""

    def process_request(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            user_id = auth_header.split(" ", 1)[1]
            try:
                user = User.objects.get(id=int(user_id))
                if not user.is_active:
                    request.user = AnonymousUser()
                else:
                    request.user = user
                request.auth = None
                return
            except (User.DoesNotExist, ValueError):
                pass
        request.user = SimpleLazyObject(lambda: get_user(request))
        request.auth = None


_MIDDLEWARE_LEAKY_AUTH = tuple(
    "tests.sentry.middleware.test_suspended.LeakyAuthMiddleware"
    if m == "sentry.middleware.auth.AuthenticationMiddleware"
    else m
    for m in settings.MIDDLEWARE
)


class SuspensionUnawareAuthBackend(EmailAuthBackend):
    """Simulates a bug where get_user() doesn't filter out suspended users."""

    def get_user(self, user_id):
        return user_service.get_user(user_id=user_id)


class SuspendedUserInjectionMiddleware:
    """Simulates a buggy middleware that injects a suspended user into the request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user_id = request.META.get("HTTP_X_INJECT_USER_ID")
        if user_id:
            request.user = User.objects.get(id=int(user_id))
            request.auth = None
        return self.get_response(request)


_MIDDLEWARE_WITH_INJECTOR: list[str] = []
for _m in settings.MIDDLEWARE:
    _MIDDLEWARE_WITH_INJECTOR.append(_m)
    if _m == "sentry.middleware.auth.AuthenticationMiddleware":
        _MIDDLEWARE_WITH_INJECTOR.append(
            "tests.sentry.middleware.test_suspended.SuspendedUserInjectionMiddleware"
        )
_MIDDLEWARE_WITH_INJECTOR_TUPLE = tuple(_MIDDLEWARE_WITH_INJECTOR)


@no_silo_test
@override_settings(ROOT_URLCONF=__name__)
class TestLeakyAuthClassBypass(APITestCase):
    """Scenario 1: New auth class forgets to check is_suspended."""

    endpoint = "suspended-test-endpoint"

    @override_settings(MIDDLEWARE=_MIDDLEWARE_LEAKY_AUTH)
    def test_leaky_auth_class_suspended_user_blocked(self):
        user = self.create_user()
        user.update(is_suspended=True)
        response = self.client.get(
            "/api/0/suspended-test/",
            HTTP_AUTHORIZATION=f"Bearer {user.id}",
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "Your account has been suspended."}

    @override_settings(MIDDLEWARE=_MIDDLEWARE_LEAKY_AUTH)
    def test_leaky_auth_class_normal_user_passes(self):
        user = self.create_user()
        response = self.client.get(
            "/api/0/suspended-test/",
            HTTP_AUTHORIZATION=f"Bearer {user.id}",
        )
        assert response.status_code != 403


@no_silo_test
@override_settings(
    ROOT_URLCONF=__name__,
    AUTHENTICATION_BACKENDS=["tests.sentry.middleware.test_suspended.SuspensionUnawareAuthBackend"],
)
class TestLeakyAuthBackendBypass(APITestCase):
    """Scenario 2: Bug in EmailAuthBackend.get_user() removes suspension check."""

    endpoint = "suspended-test-endpoint"

    def test_backend_bug_suspended_user_blocked(self):
        user = self.create_user()
        self.login_as(user)
        User.objects.filter(id=user.id).update(is_suspended=True)
        response = self.client.get("/api/0/suspended-test/")
        assert response.status_code == 403
        assert response.json() == {"detail": "Your account has been suspended."}


@no_silo_test
@override_settings(
    ROOT_URLCONF=__name__,
    MIDDLEWARE=_MIDDLEWARE_WITH_INJECTOR_TUPLE,
)
class TestBuggyMiddlewareBypass(APITestCase):
    """Scenario 3: New middleware sets request.user to a suspended user."""

    endpoint = "suspended-test-endpoint"

    def test_injected_suspended_user_blocked(self):
        user = self.create_user()
        user.update(is_suspended=True)
        response = self.client.get(
            "/api/0/suspended-test/",
            HTTP_X_INJECT_USER_ID=str(user.id),
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "Your account has been suspended."}

    def test_injected_normal_user_passes(self):
        user = self.create_user()
        response = self.client.get(
            "/api/0/suspended-test/",
            HTTP_X_INJECT_USER_ID=str(user.id),
        )
        assert response.status_code == 200

    def test_no_injection_header_unaffected(self):
        self.login_as(self.user)
        response = self.client.get("/api/0/suspended-test/")
        assert response.status_code != 403


@no_silo_test
@override_settings(
    ROOT_URLCONF=__name__,
    AUTHENTICATION_BACKENDS=["tests.sentry.middleware.test_suspended.SuspensionUnawareAuthBackend"],
)
class TestSessionNonceBypass(APITestCase):
    """Scenario 4: Session nonce mechanism bypassed — new users have no nonce."""

    endpoint = "suspended-test-endpoint"

    def test_no_nonce_set_suspension_caught(self):
        user = self.create_user()
        assert user.session_nonce is None
        self.login_as(user)
        User.objects.filter(id=user.id).update(is_suspended=True)
        response = self.client.get("/api/0/suspended-test/")
        assert response.status_code == 403

    @override_settings(SESSION_ENGINE="django.contrib.sessions.backends.db")
    def test_matching_nonce_raw_update_suspension_caught(self):
        user = self.create_user()
        self.login_as(user)
        user.refresh_session_nonce()
        user.save(update_fields=["session_nonce"])
        session = self.client.session
        session["_nonce"] = user.session_nonce
        session.save()
        User.objects.filter(id=user.id).update(is_suspended=True)
        response = self.client.get("/api/0/suspended-test/")
        assert response.status_code == 403

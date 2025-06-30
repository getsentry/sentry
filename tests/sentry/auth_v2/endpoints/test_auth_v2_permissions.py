from django.test import override_settings
from rest_framework.views import APIView

from sentry.auth_v2.endpoints.base import AuthV2Permission
from sentry.testutils.cases import DRFPermissionTestCase
from sentry.testutils.requests import drf_request_from_request


class AuthV2PermissionsTest(DRFPermissionTestCase):
    """
    See tests/sentry/api/test_permissions.py
    """

    def setUp(self):
        super().setUp()
        self.auth_v2_permission = AuthV2Permission()
        self.user = self.create_user(is_superuser=False, is_staff=False)

    def _make_request(self):
        request = self.make_request(user=self.user)
        drf_request = drf_request_from_request(request)
        return drf_request

    def test_is_dev_enabled(self):
        with override_settings(IS_DEV=True):
            request = self._make_request()
            assert self.auth_v2_permission.has_permission(request, APIView())

    def test_is_dev_disabled(self):
        with override_settings(IS_DEV=False):
            request = self._make_request()
            request.META["HTTP_X_SENTRY_AUTH_V2"] = ""  # Fail if the secret is not set
            assert not self.auth_v2_permission.has_permission(request, APIView())

    def test_secret_matches(self):
        with override_settings(AUTH_V2_SECRET="secret"):
            request = self._make_request()
            request.META["HTTP_X_SENTRY_AUTH_V2"] = "secret"
            assert self.auth_v2_permission.has_permission(request, APIView())

    def test_secret_does_not_match(self):
        with override_settings(AUTH_V2_SECRET="secret"):
            request = self._make_request()
            request.META["HTTP_X_SENTRY_AUTH_V2"] = "wrong-secret"
            assert not self.auth_v2_permission.has_permission(request, APIView())

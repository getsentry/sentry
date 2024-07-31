from functools import cached_property
from unittest.mock import MagicMock, patch

from django.test import RequestFactory, override_settings

from sentry.middleware.superuser import SuperuserMiddleware
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class SuperuserMiddlewareTestCase(TestCase):
    middleware = cached_property(SuperuserMiddleware)

    def _create_request(self, is_superuser: bool):
        request = RequestFactory().get("/")
        request.user = self.user
        request.session = self.session
        setattr(request, "organization", self.organization)

        if is_superuser:
            request.superuser = mock_su = MagicMock()
            mock_su.is_active = True
            mock_su.token = "test_token"

        return request

    @patch("sentry.middleware.superuser.logger")
    def test_su_response_not_authorized(self, mock_logger):
        request = self._create_request(is_superuser=False)
        response = MagicMock()
        self.middleware.process_response(request, response)
        mock_logger.info.assert_not_called()

    @patch("sentry.middleware.superuser.logger")
    def test_su_response_logged_when_authorized(self, mock_logger):
        request = self._create_request(is_superuser=True)
        request.user.email = "admin@sentry.io"
        response = MagicMock()
        self.middleware.process_response(request, response)
        mock_logger.info.assert_called_once_with(
            "superuser.superuser_access",
            extra={
                "superuser_token_id": "test_token",
                "user_id": self.user.id,
                "user_email": None,
                "su_org_accessed": self.organization.slug,
            },
        )

    @override_settings(SUPERUSER_STAFF_EMAIL_SUFFIX="@sentry.io")
    @patch("sentry.middleware.superuser.logger")
    def test_su_response_logged_with_email(self, mock_logger):
        request = self._create_request(is_superuser=True)
        request.user.email = "admin@sentry.io"
        response = MagicMock()
        self.middleware.process_response(request, response)
        mock_logger.info.assert_called_once_with(
            "superuser.superuser_access",
            extra={
                "superuser_token_id": "test_token",
                "user_id": self.user.id,
                "user_email": "admin@sentry.io",
                "su_org_accessed": self.organization.slug,
            },
        )

    @override_settings(SUPERUSER_STAFF_EMAIL_SUFFIX="@sentry.io")
    @patch("sentry.middleware.superuser.logger")
    def test_su_response_email_not_logged_if_not_staff(self, mock_logger):
        request = self._create_request(is_superuser=True)
        request.user.email = "personal@example.com"
        response = MagicMock()
        self.middleware.process_response(request, response)
        mock_logger.info.assert_called_once_with(
            "superuser.superuser_access",
            extra={
                "superuser_token_id": "test_token",
                "user_id": self.user.id,
                "user_email": None,
                "su_org_accessed": self.organization.slug,
            },
        )

from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.urls import reverse

from sentry import options
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


class SystemOptionsTest(APITestCase):
    url = reverse("sentry-api-0-system-options")

    def test_without_superuser(self) -> None:
        self.login_as(user=self.user, superuser=False)
        response = self.client.get(self.url)
        assert response.status_code == 403

    def test_simple(self) -> None:
        self.login_as(user=self.user, superuser=True)
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert "system.secret-key" in response.data
        assert "system.url-prefix" in response.data
        assert "system.admin-email" in response.data

    def test_redacted_secret(self) -> None:
        self.login_as(user=self.user, superuser=True)
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data["github-login.client-secret"]["value"] == "[redacted]"

    def test_bad_query(self) -> None:
        self.login_as(user=self.user, superuser=True)
        response = self.client.get(self.url, {"query": "nonsense"})
        assert response.status_code == 400
        assert "nonsense" in response.data

    def test_required(self) -> None:
        self.login_as(user=self.user, superuser=True)
        response = self.client.get(self.url, {"query": "is:required"})
        assert response.status_code == 200
        assert "system.url-prefix" in response.data

    def test_not_logged_in(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 401
        response = self.client.put(self.url)
        assert response.status_code == 401

    def test_disabled_smtp(self) -> None:
        self.login_as(user=self.user, superuser=True)

        with self.options({"mail.backend": "smtp"}):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data["mail.host"]["field"]["disabled"] is False
            assert response.data["mail.host"]["field"]["disabledReason"] is None

        with self.options({"mail.backend": "dummy"}):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data["mail.host"]["field"]["disabled"] is True
            assert response.data["mail.host"]["field"]["disabledReason"] == "smtpDisabled"

    def test_put_user_access_forbidden(self) -> None:
        self.login_as(user=self.user, superuser=False)
        response = self.client.put(self.url, {"auth.allow-registration": 1})
        assert response.status_code == 403

    def test_put_self_hosted_superuser_access_allowed(self) -> None:
        with override_settings(SENTRY_SELF_HOSTED=True):
            self.login_as(user=self.user, superuser=True)
            response = self.client.put(self.url, {"auth.allow-registration": 1})
            assert response.status_code == 200

    def test_put_int_for_boolean(self) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")
        response = self.client.put(self.url, {"auth.allow-registration": 1})
        assert response.status_code == 200

    def test_put_unknown_option(self) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")
        response = self.client.put(self.url, {"xxx": "lol"})
        assert response.status_code == 400
        assert response.data["error"] == "unknown_option"

    def test_put_hardwired_option(self) -> None:
        with override_options({"system.url-prefix": "cheese"}):
            self.login_as(user=self.user, superuser=True)
            self.add_user_permission(self.user, "options.admin")
            response = self.client.put(self.url, {"system.url-prefix": "bread"})
            assert response.status_code == 400
            assert response.data["error"] == "immutable_option"

    def test_allowed_option_without_permission(self) -> None:
        self.login_as(user=self.user, superuser=True)
        response = self.client.put(self.url, {"system.admin-email": "new_admin@example.com"})
        assert response.status_code == 200
        assert options.get("system.admin-email") == "new_admin@example.com"

    def test_empty_payload_without_permission(self) -> None:
        with override_settings(SENTRY_SELF_HOSTED=False):
            self.login_as(user=self.user, superuser=True)
            response = self.client.put(self.url, {})
            assert response.status_code == 403

    def test_disallowed_substring_key_without_permission(self) -> None:
        with override_settings(SENTRY_SELF_HOSTED=False):
            self.login_as(user=self.user, superuser=True)
            response = self.client.put(self.url, {"system": "x"})
            assert response.status_code == 403

    def test_put_simple(self) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")
        assert options.get("mail.host") != "lolcalhost"
        response = self.client.put(self.url, {"mail.host": "lolcalhost"})
        assert response.status_code == 200
        assert options.get("mail.host") == "lolcalhost"

    @patch("sentry.api.endpoints.system_options.logger")
    def test_put_redacts_credential_option_value_in_log(self, mock_logger: MagicMock) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")
        response = self.client.put(self.url, {"github-app.webhook-secret": "super-secret-value"})
        assert response.status_code == 200
        assert options.get("github-app.webhook-secret") == "super-secret-value"

        mock_logger.info.assert_called_once()
        args, kwargs = mock_logger.info.call_args
        assert args[0] == "options.update"
        assert kwargs["extra"]["option_key"] == "github-app.webhook-secret"
        assert kwargs["extra"]["option_value"] == "[redacted]"

    @patch("sentry.api.endpoints.system_options.logger")
    def test_put_does_not_redact_non_secret_option(self, mock_logger: MagicMock) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")
        response = self.client.put(self.url, {"system.admin-email": "new_admin@example.com"})
        assert response.status_code == 200

        mock_logger.info.assert_called_once()
        args, kwargs = mock_logger.info.call_args
        assert args[0] == "options.update"
        assert kwargs["extra"]["option_key"] == "system.admin-email"
        assert kwargs["extra"]["option_value"] == "new_admin@example.com"

    def test_update_channel(self) -> None:
        assert options.get_last_update_channel("auth.allow-registration") is None
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")
        response = self.client.put(self.url, {"auth.allow-registration": 1})
        assert response.status_code == 200
        assert (
            options.get_last_update_channel("auth.allow-registration")
            == options.UpdateChannel.APPLICATION
        )

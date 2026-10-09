from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.request import Request

import sentry
from sentry import application_state, options
from sentry.api.endpoints.system_options import SystemOptionsEndpoint
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.web.client_config import get_client_config


@pytest.mark.parametrize("key", ["system.admin-email", "mail.host", "api.rate-limit.org-create"])
@pytest.mark.parametrize("value", ["updated", "", None])
def test_saas_rejects_mutations_before_transaction(key: str, value) -> None:
    request = MagicMock(spec=Request)
    request.data = {key: value}
    endpoint = SystemOptionsEndpoint()
    with (
        override_settings(SENTRY_SELF_HOSTED=False),
        patch.object(endpoint, "has_permission", return_value=True),
        patch(
            "sentry.api.endpoints.system_options.transaction.atomic",
            side_effect=AssertionError("option transaction opened"),
        ),
        patch.object(options.default_store, "set", side_effect=AssertionError("store write")),
        patch.object(options.default_store, "delete", side_effect=AssertionError("store delete")),
    ):
        response = endpoint.put(request)
    assert response.status_code == 400
    assert response.data["error"] == "immutable_option"
    assert response.data["errorDetail"]["option"] == key
    assert "cannot be changed at runtime" in response.data["errorDetail"]["message"]


class SystemOptionsTest(APITestCase):
    url = reverse("sentry-api-0-system-options")

    def test_support_email_update_is_visible_in_client_config(self) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")

        with override_settings(SENTRY_SYSTEM_SUPPORT_EMAIL="", SENTRY_OPTIONS={}):
            response = self.client.put(self.url, {"system.support-email": "support@example.com"})

            assert response.status_code == 200
            assert get_client_config()["supportEmail"] == "support@example.com"

    def test_without_superuser(self) -> None:
        self.login_as(user=self.user, superuser=False)
        response = self.client.get(self.url)
        assert response.status_code == 403

    def test_setup_records_configured_version(self) -> None:
        self.login_as(user=self.user, superuser=True)
        application_state.delete("sentry:version-configured")
        response = self.client.put(self.url, {}, format="json")
        assert response.status_code == 200
        assert application_state.get("sentry:version-configured") == sentry.get_version()

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
        assert response.data["system.secret-key"]["value"] == "[redacted]"

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

    def test_required_disables_mail_tls_ssl_pair_when_one_disk_value_is_non_default(self) -> None:
        self.login_as(user=self.user, superuser=True)

        with override_options({"mail.use-tls": True, "mail.use-ssl": False}):
            response = self.client.get(self.url, {"query": "is:required"})

        assert response.status_code == 200
        assert response.data["mail.use-tls"]["field"]["disabled"] is True
        assert response.data["mail.use-tls"]["field"]["disabledReason"] == "diskPriority"
        assert response.data["mail.use-ssl"]["field"]["disabled"] is True
        assert response.data["mail.use-ssl"]["field"]["disabledReason"] == "diskPriority"

    def test_required_keeps_mail_tls_ssl_pair_enabled_when_disk_values_match_defaults(self) -> None:
        self.login_as(user=self.user, superuser=True)

        with override_options({"mail.use-tls": False, "mail.use-ssl": False}):
            response = self.client.get(self.url, {"query": "is:required"})

        assert response.status_code == 200
        assert response.data["mail.use-tls"]["field"]["disabled"] is False
        assert response.data["mail.use-tls"]["field"]["disabledReason"] is None
        assert response.data["mail.use-ssl"]["field"]["disabled"] is False
        assert response.data["mail.use-ssl"]["field"]["disabledReason"] is None

    def test_not_logged_in(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 401
        response = self.client.put(self.url)
        assert response.status_code == 401

    def test_disabled_smtp(self) -> None:
        self.login_as(user=self.user, superuser=True)

        with override_settings(EMAIL_BACKEND="smtp"):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data["mail.host"]["field"]["disabled"] is False
            assert response.data["mail.host"]["field"]["disabledReason"] is None

        with override_settings(EMAIL_BACKEND="dummy"):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert response.data["mail.host"]["field"]["disabled"] is True
            assert response.data["mail.host"]["field"]["disabledReason"] == "smtpDisabled"
            assert response.data["mail.use-tls"]["field"]["disabled"] is True
            assert response.data["mail.use-tls"]["field"]["disabledReason"] == "smtpDisabled"
            assert response.data["mail.use-ssl"]["field"]["disabled"] is True
            assert response.data["mail.use-ssl"]["field"]["disabledReason"] == "smtpDisabled"

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
    def test_put_rejects_immutable_secret_without_logging_value(self, mock_logger: MagicMock) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")
        response = self.client.put(self.url, {"system.secret-key": "super-secret-value"})
        assert response.status_code == 400
        assert response.data["error"] == "immutable_option"
        mock_logger.info.assert_not_called()

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


    def test_put_retired_deployment_option_is_unknown(self) -> None:
        self.login_as(user=self.user, superuser=True)
        self.add_user_permission(self.user, "options.admin")

        response = self.client.put(self.url, {"github-app.webhook-secret": "test-secret"})
        assert response.status_code == 400
        assert response.data["error"] == "unknown_option"
        assert response.data["errorDetail"]["option"] == "github-app.webhook-secret"

        response = self.client.put(self.url, {"github-app.client-id": "test-client-id"})
        assert response.status_code == 400
        assert response.data["error"] == "unknown_option"
        assert response.data["errorDetail"]["option"] == "github-app.client-id"

        response = self.client.put(self.url, {"chart-rendering.enabled": True})
        assert response.status_code == 400
        assert response.data["error"] == "unknown_option"
        assert response.data["errorDetail"]["option"] == "chart-rendering.enabled"

from __future__ import annotations

from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses
from cryptography.fernet import Fernet
from django.urls import reverse

from sentry.integrations.jira.forge.client import CONNECT_CLIENT_KEY_PROPERTY
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocation,
    ForgeInvocationTokenError,
)
from sentry.integrations.jira.tasks import sync_forge_installation
from sentry.integrations.models.integration import Integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test

CLOUD_ID = "11111111-2222-3333-4444-555555555555"
API_BASE_URL = f"https://api.atlassian.com/ex/jira/{CLOUD_ID}"
INSTALLATION_ID = "ari:cloud:ecosystem::installation/test-installation"
APP_ID = "ari:cloud:ecosystem::app/test"
SYSTEM_TOKEN_EXPIRES_AT = 1900000000
# Atlassian requires system tokens to be treated as opaque.
SYSTEM_TOKEN = "opaque-system-token"


def _invocation(**overrides: str | None) -> ForgeInvocation:
    fields: dict[str, str | None] = {
        "app_id": "ari:cloud:ecosystem::app/test",
        "installation_id": INSTALLATION_ID,
        "api_base_url": API_BASE_URL,
        "cloud_id": CLOUD_ID,
        "environment_type": "DEVELOPMENT",
        "module_key": "jira-forge-installed",
        "principal": None,
    }
    fields.update(overrides)
    return ForgeInvocation(**fields)  # type: ignore[arg-type]


@control_silo_test
@patch("sentry.integrations.jira.webhooks.forge_installation.sync_forge_installation")
@patch("sentry.integrations.jira.forge.invocation_token.verify_forge_invocation_token")
class JiraForgeInstallationWebhookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("sentry-extensions-jira-forge-installation")
        self.headers = {"Authorization": "Bearer fit", "X-Forge-OAuth-System": SYSTEM_TOKEN}

    def test_queues_encrypted_installation(
        self, mock_verify: MagicMock, mock_task: MagicMock
    ) -> None:
        mock_verify.return_value = _invocation()
        fernet = Fernet(Fernet.generate_key())

        with patch(
            "sentry.utils.security.encrypted_field_key_store.FernetKeyStore.get_primary_fernet",
            return_value=("key", fernet),
        ):
            response = self.client.post(self.url, headers=self.headers)

        assert response.status_code == 202
        mock_verify.assert_called_once_with("fit")
        kwargs = mock_task.delay.call_args.kwargs
        assert SYSTEM_TOKEN not in kwargs["encrypted_payload"]
        with (
            patch(
                "sentry.integrations.jira.tasks.FernetKeyStore.get_fernet_for_key_id",
                return_value=fernet,
            ),
            patch(
                "sentry.integrations.jira.tasks.ForgeInstallationClient.get_connect_client_key",
                return_value="connect-client-key",
            ) as mock_get_key,
            pytest.raises(Integration.DoesNotExist),
        ):
            sync_forge_installation(**kwargs)
        mock_get_key.assert_called_once_with()

    @freeze_time("2025-01-01 00:00:00")
    def test_takes_site_from_api_base_url(
        self, mock_verify: MagicMock, mock_task: MagicMock
    ) -> None:
        # Backend invocations like lifecycle events can have an empty `context`.
        mock_verify.return_value = _invocation(cloud_id=None)
        fernet = Fernet(Fernet.generate_key())

        with patch(
            "sentry.utils.security.encrypted_field_key_store.FernetKeyStore.get_primary_fernet",
            return_value=("key", fernet),
        ):
            response = self.client.post(self.url, headers=self.headers)

        assert response.status_code == 202
        payload = orjson.loads(
            fernet.decrypt(mock_task.delay.call_args.kwargs["encrypted_payload"])
        )
        assert payload["cloud_id"] == CLOUD_ID
        # Two hours from receipt, the token's guaranteed minimum lifetime.
        assert payload["system_token_expires_at"] == 1735689600 + 2 * 60 * 60

    def test_rejects_bad_requests(self, mock_verify: MagicMock, mock_task: MagicMock) -> None:
        mock_verify.side_effect = ForgeInvocationTokenError("bad")
        assert self.client.post(self.url, headers=self.headers).status_code == 401
        assert self.client.post(self.url).status_code == 401

        mock_verify.side_effect = None
        # The system token is sent to api_base_url, so it must be Atlassian's API for the site.
        mock_verify.return_value = _invocation(api_base_url="https://attacker.example.com")
        assert self.client.post(self.url, headers=self.headers).status_code == 400
        mock_verify.return_value = _invocation(api_base_url=f"{API_BASE_URL}/extra")
        assert self.client.post(self.url, headers=self.headers).status_code == 400
        mock_verify.return_value = _invocation(cloud_id="99999999-2222-3333-4444-555555555555")
        assert self.client.post(self.url, headers=self.headers).status_code == 400
        mock_verify.return_value = _invocation()
        response = self.client.post(self.url, headers={"Authorization": "Bearer fit"})
        assert response.status_code == 400

        assert not mock_task.delay.called


@control_silo_test
class SyncForgeInstallationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.fernet = Fernet(Fernet.generate_key())
        self.property_url = (
            f"{API_BASE_URL}/rest/atlassian-connect/1/addons/testserver.jira/properties/"
            f"{CONNECT_CLIENT_KEY_PROPERTY}"
        )
        self.server_info_url = f"{API_BASE_URL}/rest/api/3/serverInfo"

    def sync(
        self,
        installation_id: str = INSTALLATION_ID,
        system_token_expires_at: int = SYSTEM_TOKEN_EXPIRES_AT,
    ) -> None:
        payload = {
            "app_id": APP_ID,
            "installation_id": installation_id,
            "cloud_id": CLOUD_ID,
            "api_base_url": API_BASE_URL,
            "system_token": SYSTEM_TOKEN,
            "system_token_expires_at": system_token_expires_at,
        }
        with patch(
            "sentry.integrations.jira.tasks.FernetKeyStore.get_fernet_for_key_id",
            return_value=self.fernet,
        ):
            sync_forge_installation("key", self.fernet.encrypt(orjson.dumps(payload)).decode())

    def forge_metadata(self, installation_id: str = INSTALLATION_ID) -> dict[str, object]:
        return {
            "cloud_id": CLOUD_ID,
            "installation_id": installation_id,
            "api_base_url": API_BASE_URL,
            "system_token": SYSTEM_TOKEN,
            "system_token_expires_at": SYSTEM_TOKEN_EXPIRES_AT,
        }

    @responses.activate
    def test_records_forge_installation_on_connect_integration(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            external_id="connect-client-key",
            provider="jira",
            metadata={"shared_secret": "secret", "base_url": "https://example.atlassian.net"},
        )
        responses.get(self.property_url, json={"value": "connect-client-key"})

        self.sync()
        self.sync(installation_id="ari:cloud:ecosystem::installation/reinstalled")

        integration.refresh_from_db()
        assert integration.external_id == "connect-client-key"
        assert integration.metadata == {
            "shared_secret": "secret",
            "base_url": "https://example.atlassian.net",
            "forge": self.forge_metadata("ari:cloud:ecosystem::installation/reinstalled"),
        }
        assert responses.calls[0].request.headers["Authorization"] == f"Bearer {SYSTEM_TOKEN}"

    @responses.activate
    @override_options({"jira.forge.native-app-ids": [APP_ID]})
    def test_creates_forge_only_integration_keyed_by_cloud_id(self) -> None:
        responses.get(
            self.server_info_url,
            json={"baseUrl": "https://example.atlassian.net", "serverTitle": "Example"},
        )

        self.sync()
        # A reinstall finds the integration by cloud ID without calling Jira again.
        self.sync(installation_id="ari:cloud:ecosystem::installation/reinstalled")

        integration = Integration.objects.get(provider="jira", external_id=CLOUD_ID)
        assert integration.name == "Example"
        assert integration.metadata == {
            "base_url": "https://example.atlassian.net",
            "domain_name": "example.atlassian.net",
            "forge": self.forge_metadata("ari:cloud:ecosystem::installation/reinstalled"),
        }
        # A Forge-native app never has a Connect install to look up.
        assert len(responses.calls) == 1

    @responses.activate
    @override_options({"jira.forge.native-app-ids": [APP_ID]})
    def test_keeps_the_newest_token(self) -> None:
        responses.get(
            self.server_info_url,
            json={"baseUrl": "https://example.atlassian.net", "serverTitle": "Example"},
        )

        self.sync()
        # A delayed retry carrying an older token.
        self.sync(system_token_expires_at=SYSTEM_TOKEN_EXPIRES_AT - 60)

        integration = Integration.objects.get(provider="jira", external_id=CLOUD_ID)
        assert integration.metadata["forge"] == self.forge_metadata()

    @responses.activate
    def test_does_not_record_unless_the_site_matches(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            external_id="connect-client-key",
            provider="jira",
            metadata={"forge": {**self.forge_metadata(), "cloud_id": "other-site"}},
        )

        # The Connect `installed` callback hasn't created the integration yet; the task retries.
        responses.get(self.property_url, json={"value": "unknown-client-key"})
        with pytest.raises(Integration.DoesNotExist):
            self.sync()

        # Jira hasn't granted API access yet; the task retries.
        responses.replace(responses.GET, self.property_url, status=403)
        with pytest.raises(ApiError):
            self.sync()
        # A missing clientKey is retried too, never taken to mean there's no Connect install.
        responses.replace(responses.GET, self.property_url, status=404)
        with pytest.raises(ApiError):
            self.sync()
        assert not Integration.objects.filter(provider="jira", external_id=CLOUD_ID).exists()

        # The integration is already linked to a different site.
        responses.replace(responses.GET, self.property_url, json={"value": "connect-client-key"})
        with pytest.raises(ValueError):
            self.sync()

        integration.refresh_from_db()
        assert integration.metadata["forge"]["cloud_id"] == "other-site"

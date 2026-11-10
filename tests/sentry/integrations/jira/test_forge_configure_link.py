from __future__ import annotations

from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocation,
    ForgeInvocationTokenError,
)
from sentry.integrations.jira.views import SALT
from sentry.integrations.jira.webhooks.forge_configure_link import FORGE_CONFIGURE_MODULE_KEY
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import unsign

CLOUD_ID = "11111111-2222-3333-4444-555555555555"
INSTALLATION_ID = "ari:cloud:ecosystem::installation/test"


def _invocation(**overrides: str | None) -> ForgeInvocation:
    fields: dict[str, str | None] = {
        "app_id": "ari:cloud:ecosystem::app/test",
        "installation_id": INSTALLATION_ID,
        "api_base_url": f"https://api.atlassian.com/ex/jira/{CLOUD_ID}",
        "cloud_id": CLOUD_ID,
        "environment_type": "DEVELOPMENT",
        "module_key": FORGE_CONFIGURE_MODULE_KEY,
        "principal": "admin-account-id",
    }
    fields.update(overrides)
    return ForgeInvocation(**fields)  # type: ignore[arg-type]


@control_silo_test
@patch("sentry.integrations.jira.forge.invocation_token.verify_forge_invocation_token")
class JiraForgeConfigureLinkWebhookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("sentry-extensions-jira-forge-configure-link")
        self.headers = {"Authorization": "Bearer fit"}

    def test_returns_signed_configure_link(self, mock_verify: MagicMock) -> None:
        self.create_provider_integration(
            provider="jira",
            external_id=CLOUD_ID,
            metadata={
                "base_url": "https://example.net",
                "forge": {"installation_id": INSTALLATION_ID},
            },
        )
        mock_verify.return_value = _invocation()

        response = self.client.post(self.url, headers=self.headers)

        assert response.status_code == 200
        link = urlparse(response.data["link"])
        assert link.path == "/extensions/jira/configure/."
        signed_params = parse_qs(link.query)["signed_params"][0]
        assert unsign(signed_params, salt=SALT) == {"external_id": CLOUD_ID}

    def test_rejects_bad_requests(self, mock_verify: MagicMock) -> None:
        mock_verify.side_effect = ForgeInvocationTokenError("bad")
        assert self.client.post(self.url, headers=self.headers).status_code == 401
        mock_verify.side_effect = None

        # Only the admin config page, invoked by a user, may mint links.
        mock_verify.return_value = _invocation(module_key="issue-panel")
        assert self.client.post(self.url, headers=self.headers).status_code == 403
        mock_verify.return_value = _invocation(principal=None)
        assert self.client.post(self.url, headers=self.headers).status_code == 403

        mock_verify.return_value = _invocation(api_base_url="https://attacker.example.com")
        assert self.client.post(self.url, headers=self.headers).status_code == 400

        # Not installed yet, or disabled.
        mock_verify.return_value = _invocation()
        assert self.client.post(self.url, headers=self.headers).status_code == 404
        integration = self.create_provider_integration(
            provider="jira",
            external_id=CLOUD_ID,
            status=ObjectStatus.DISABLED,
            metadata={"forge": {"installation_id": INSTALLATION_ID}},
        )
        assert self.client.post(self.url, headers=self.headers).status_code == 404

        # Installed by a different Forge app or installation.
        integration.update(status=ObjectStatus.ACTIVE)
        mock_verify.return_value = _invocation(
            installation_id="ari:cloud:ecosystem::installation/other"
        )
        assert self.client.post(self.url, headers=self.headers).status_code == 404

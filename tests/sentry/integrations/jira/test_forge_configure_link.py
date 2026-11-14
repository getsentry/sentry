from __future__ import annotations

from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import responses
from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocation,
    ForgeInvocationTokenError,
    ForgeSigningKeysUnavailableError,
)
from sentry.integrations.jira.views import SALT
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import unsign

CLOUD_ID = "11111111-2222-3333-4444-555555555555"
INSTALLATION_ID = "ari:cloud:ecosystem::installation/test"
MY_PERMISSIONS_URL = f"https://api.atlassian.com/ex/jira/{CLOUD_ID}/rest/api/3/mypermissions"


def _mock_admin(have_permission: bool) -> None:
    responses.add(
        responses.GET,
        MY_PERMISSIONS_URL,
        match=[responses.matchers.query_param_matcher({"permissions": "ADMINISTER"})],
        json={
            "permissions": {"ADMINISTER": {"key": "ADMINISTER", "havePermission": have_permission}}
        },
    )


def _invocation(**overrides: str | None) -> ForgeInvocation:
    fields: dict[str, str | None] = {
        "app_id": "ari:cloud:ecosystem::app/test",
        "installation_id": INSTALLATION_ID,
        "api_base_url": f"https://api.atlassian.com/ex/jira/{CLOUD_ID}",
        "cloud_id": CLOUD_ID,
        "environment_type": "DEVELOPMENT",
        "module_key": "sentry-configure",
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
        self.headers = {"Authorization": "Bearer fit", "X-Forge-OAuth-User": "user-token"}

    def create_forge_integration(self) -> None:
        self.create_provider_integration(
            provider="jira",
            external_id=CLOUD_ID,
            metadata={
                "base_url": "https://example.net",
                "forge": {"installation_id": INSTALLATION_ID},
            },
        )

    @responses.activate
    def test_returns_signed_configure_link(self, mock_verify: MagicMock) -> None:
        self.create_forge_integration()
        mock_verify.return_value = _invocation()
        _mock_admin(True)

        response = self.client.post(self.url, headers=self.headers)

        assert response.status_code == 200
        # Asked as the caller, not as the app.
        assert responses.calls[0].request.headers["Authorization"] == "Bearer user-token"
        link = urlparse(response.data["link"])
        assert link.path == "/extensions/jira/configure/."
        signed_params = parse_qs(link.query)["signed_params"][0]
        assert unsign(signed_params, salt=SALT) == {"external_id": CLOUD_ID}

    @responses.activate
    def test_requires_a_jira_admin(self, mock_verify: MagicMock) -> None:
        self.create_forge_integration()
        mock_verify.return_value = _invocation()

        _mock_admin(False)
        assert self.client.post(self.url, headers=self.headers).status_code == 403

        headers = {"Authorization": "Bearer fit"}
        assert self.client.post(self.url, headers=headers).status_code == 403

        responses.replace(responses.GET, MY_PERMISSIONS_URL, status=500)
        assert self.client.post(self.url, headers=self.headers).status_code == 502
        responses.replace(responses.GET, MY_PERMISSIONS_URL, body="<html>", status=200)
        assert self.client.post(self.url, headers=self.headers).status_code == 502

    @responses.activate
    def test_rejects_bad_requests(self, mock_verify: MagicMock) -> None:
        mock_verify.side_effect = ForgeInvocationTokenError("bad")
        assert self.client.post(self.url, headers=self.headers).status_code == 401
        mock_verify.side_effect = ForgeSigningKeysUnavailableError("down")
        assert self.client.post(self.url, headers=self.headers).status_code == 503
        mock_verify.side_effect = None

        # Only a user can be checked for Jira admin.
        mock_verify.return_value = _invocation(principal=None)
        assert self.client.post(self.url, headers=self.headers).status_code == 403

        mock_verify.return_value = _invocation(api_base_url="https://attacker.example.com")
        assert self.client.post(self.url, headers=self.headers).status_code == 400

        # Not installed yet, or disabled.
        mock_verify.return_value = _invocation()
        _mock_admin(True)
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

"""Tests for the Slack staging sidegrade feature (Option 4).

This feature allows organizations to sidegrade their production Slack integration
to a staging app and vice versa, by swapping credentials in-place on the existing
Integration row.
"""

from unittest import mock
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlencode, urlparse

import orjson
import pytest
import responses

from sentry import options
from sentry.integrations.models.integration import Integration
from sentry.integrations.slack import SlackIntegrationProvider
from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.integrations.slack.utils.auth import set_signing_secret
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.slack.test_integration import SlackIntegrationTest

STAGING_CLIENT_ID = "staging-client-id"
STAGING_CLIENT_SECRET = "staging-client-secret"
STAGING_SIGNING_SECRET = "staging-signing-secret"

STAGING_OPTIONS = {
    "slack-staging.client-id": STAGING_CLIENT_ID,
    "slack-staging.client-secret": STAGING_CLIENT_SECRET,
    "slack-staging.signing-secret": STAGING_SIGNING_SECRET,
}


@control_silo_test
class SlackStagingSetupGatingTest(TestCase):
    """Tests for the use_staging query param gating in OrganizationIntegrationSetupView."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(name="foo", owner=self.user)
        self.login_as(self.user)
        self.path = f"/organizations/{self.organization.slug}/integrations/slack/setup/"

    def test_use_staging_without_feature_flag_returns_404(self) -> None:
        resp = self.client.get(f"{self.path}?use_staging=1")
        assert resp.status_code == 404

    @with_feature({"organizations:slack-staging-app": True})
    def test_use_staging_with_feature_flag_proceeds(self) -> None:
        resp = self.client.get(f"{self.path}?use_staging=1")
        assert resp.status_code == 302

    def test_non_slack_provider_ignores_use_staging(self) -> None:
        path = f"/organizations/{self.organization.slug}/integrations/example/setup/"
        resp = self.client.get(f"{path}?use_staging=1")
        assert resp.status_code == 200

    @with_feature({"organizations:slack-staging-app": True})
    def test_use_staging_value_must_be_1(self) -> None:
        """Only use_staging=1 triggers staging mode, not other truthy values."""
        resp = self.client.get(f"{self.path}?use_staging=true")
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        params = parse_qs(redirect.query)
        assert params["client_id"] == [options.get("slack.client-id")]


@control_silo_test
class SlackIdentityProviderStagingTest(TestCase):
    """Tests for SlackIdentityProvider staging credential selection."""

    def _make_provider(self, use_staging=False):
        from sentry.identity.slack.provider import SlackIdentityProvider

        provider = SlackIdentityProvider()
        if use_staging:
            provider.update_config({"use_staging": True})
        return provider

    def test_returns_production_credentials_by_default(self) -> None:
        provider = self._make_provider()
        assert provider.get_oauth_client_id() == options.get("slack.client-id")
        assert provider.get_oauth_client_secret() == options.get("slack.client-secret")

    @override_options(STAGING_OPTIONS)
    def test_returns_staging_credentials_when_use_staging(self) -> None:
        provider = self._make_provider(use_staging=True)
        assert provider.get_oauth_client_id() == STAGING_CLIENT_ID
        assert provider.get_oauth_client_secret() == STAGING_CLIENT_SECRET

    @override_options(STAGING_OPTIONS)
    def test_use_staging_false_returns_production(self) -> None:
        from sentry.identity.slack.provider import SlackIdentityProvider

        provider = SlackIdentityProvider()
        provider.update_config({"use_staging": False})
        assert provider.get_oauth_client_id() == options.get("slack.client-id")
        assert provider.get_oauth_client_secret() == options.get("slack.client-secret")


@control_silo_test
class SlackIntegrationProviderBuildIntegrationTest(TestCase):
    """Tests for the installation_type field in build_integration()."""

    def _build_integration(self, use_staging=False):
        provider = SlackIntegrationProvider()
        if use_staging:
            provider.config = {"use_staging": True}

        state = {
            "identity": {
                "data": {
                    "ok": True,
                    "access_token": "xoxb-token",
                    "scope": "chat:write,commands",
                    "team": {"id": "TXXXXXXX1", "name": "Example"},
                    "authed_user": {"id": "UXXXXXXX1"},
                }
            }
        }
        with patch(
            "slack_sdk.web.client.WebClient._perform_urllib_http_request",
            return_value={
                "body": orjson.dumps(
                    {
                        "ok": True,
                        "team": {
                            "domain": "test-workspace",
                            "icon": {"image_132": "http://example.com/icon.jpg"},
                        },
                    }
                ).decode(),
                "headers": {},
                "status": 200,
            },
        ):
            return provider.build_integration(state)

    def test_production_installation_type(self) -> None:
        result = self._build_integration(use_staging=False)
        assert result["metadata"]["installation_type"] == "born_as_bot"

    def test_staging_installation_type(self) -> None:
        result = self._build_integration(use_staging=True)
        assert result["metadata"]["installation_type"] == "staging"


@control_silo_test
class SlackRequestStagingAuthTest(TestCase):
    """Tests for SlackRequest.authorize() staging signing secret fallback."""

    def _make_signed_request(self, secret: str) -> mock.Mock:
        request = mock.Mock()
        request.data = {
            "type": "foo",
            "team_id": "T001",
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }
        request.body = urlencode(request.data).encode("utf-8")
        request.META = set_signing_secret(secret, request.body)
        return request

    def test_production_signing_secret_accepted(self) -> None:
        request = self._make_signed_request(options.get("slack.signing-secret"))
        SlackRequest(request).authorize()

    @override_options(STAGING_OPTIONS)
    def test_staging_signing_secret_accepted(self) -> None:
        request = self._make_signed_request(STAGING_SIGNING_SECRET)
        SlackRequest(request).authorize()

    def test_invalid_signing_secret_rejected(self) -> None:
        request = self._make_signed_request("totally-wrong-secret")
        with pytest.raises(SlackRequestError) as exc_info:
            SlackRequest(request).authorize()
        assert exc_info.value.status == 401


@control_silo_test
@patch(
    "slack_sdk.web.client.WebClient._perform_urllib_http_request",
    return_value={
        "body": orjson.dumps(
            {
                "ok": True,
                "team": {
                    "domain": "test-slack-workspace",
                    "icon": {"image_132": "http://example.com/ws_icon.jpg"},
                },
            }
        ).decode(),
        "headers": {},
        "status": 200,
    },
)
class SlackStagingSidegradeFlowTest(IntegrationTestCase):
    """Tests for the end-to-end sidegrade: production -> staging -> production."""

    provider = SlackIntegrationProvider
    assert_setup_flow = SlackIntegrationTest.assert_setup_flow

    @responses.activate
    @with_feature({"organizations:slack-staging-app": True})
    @override_options(STAGING_OPTIONS)
    def test_staging_flow_uses_staging_credentials(self, mock_api_call: MagicMock) -> None:
        """The staging OAuth flow uses staging client ID/secret and sets installation_type."""
        with self.tasks():
            self.assert_setup_flow(
                expected_client_id=STAGING_CLIENT_ID,
                expected_client_secret=STAGING_CLIENT_SECRET,
                init_params={"use_staging": "1"},
            )

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.metadata["installation_type"] == "staging"

    @responses.activate
    @with_feature({"organizations:slack-staging-app": True})
    @override_options(STAGING_OPTIONS)
    def test_sidegrade_updates_existing_integration_in_place(
        self, mock_api_call: MagicMock
    ) -> None:
        """Sidegrading replaces credentials on the existing Integration row."""
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.metadata["installation_type"] == "born_as_bot"
        original_id = integration.id

        with self.tasks():
            self.assert_setup_flow(
                expected_client_id=STAGING_CLIENT_ID,
                expected_client_secret=STAGING_CLIENT_SECRET,
                init_params={"use_staging": "1"},
            )

        integration.refresh_from_db()
        assert integration.id == original_id
        assert integration.metadata["installation_type"] == "staging"
        assert Integration.objects.filter(provider=self.provider.key).count() == 1

    @responses.activate
    @with_feature({"organizations:slack-staging-app": True})
    @override_options(STAGING_OPTIONS)
    def test_sidegrade_back_to_production(self, mock_api_call: MagicMock) -> None:
        """Re-installing without staging after a sidegrade restores production metadata."""
        with self.tasks():
            self.assert_setup_flow(
                expected_client_id=STAGING_CLIENT_ID,
                expected_client_secret=STAGING_CLIENT_SECRET,
                init_params={"use_staging": "1"},
            )

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.metadata["installation_type"] == "staging"

        with self.tasks():
            self.assert_setup_flow()

        integration.refresh_from_db()
        assert integration.metadata["installation_type"] == "born_as_bot"

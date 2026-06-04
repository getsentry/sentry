from django.urls import reverse

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class SlackStagingConfigVisibilityTest(APITestCase):
    """Test that the slack-staging provider is only visible to orgs with the feature flag."""

    endpoint = "sentry-api-0-organization-config-integrations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_hidden_without_flag(self) -> None:
        response = self.get_success_response(self.organization.slug)
        provider_keys = [p["key"] for p in response.data["providers"]]
        assert "slack_staging" not in provider_keys

    def test_visible_with_flag(self) -> None:
        with self.feature("organizations:integrations-slack-staging"):
            response = self.get_success_response(self.organization.slug)
        provider_keys = [p["key"] for p in response.data["providers"]]
        assert "slack_staging" in provider_keys


@control_silo_test
class SlackStagingSetupAccessTest(APITestCase):
    """Test that the slack-staging install flow is gated by the feature flag."""

    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.pipeline_url = reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def test_setup_blocked_without_flag(self) -> None:
        resp = self.client.post(
            self.pipeline_url,
            data={"action": "initialize", "provider": "slack_staging"},
            content_type="application/json",
        )
        assert resp.status_code == 404

    def test_setup_allowed_with_flag(self) -> None:
        with self.feature("organizations:integrations-slack-staging"):
            resp = self.client.post(
                self.pipeline_url,
                data={"action": "initialize", "provider": "slack_staging"},
                content_type="application/json",
            )
        assert resp.status_code == 200
        assert resp.data["step"] == "oauth_login"
        assert "slack.com/oauth" in resp.data["data"]["oauthUrl"]

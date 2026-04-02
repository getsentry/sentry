from sentry.testutils.cases import APITestCase, TestCase
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
class SlackStagingSetupAccessTest(TestCase):
    """Test that the slack-staging install flow is gated by the feature flag."""

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(name="test", owner=self.user)
        self.login_as(self.user)
        self.path = f"/organizations/{self.organization.slug}/integrations/slack_staging/setup/"

    def test_setup_blocked_without_flag(self) -> None:
        resp = self.client.get(self.path)
        assert resp.status_code == 404

    def test_setup_allowed_with_flag(self) -> None:
        with self.feature("organizations:integrations-slack-staging"):
            resp = self.client.get(self.path)
        # 302 to Slack OAuth is the expected behavior for a valid setup flow
        assert resp.status_code == 302
        assert "slack.com/oauth" in resp["Location"]

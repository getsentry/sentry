from sentry.integrations.slack.integration import SlackIntegration
from sentry.integrations.slack.utils.feature import organization_integration_has_feature_enabled
from sentry.testutils.cases import TestCase


class TestOrganizationIntegrationHasFeatureEnabled(TestCase):
    def test_returns_false(self) -> None:
        slack_provider_integration = self.create_provider_integration(
            provider="slack", name="Slack", metadata={}
        )
        self.create_organization_integration(
            organization_id=self.organization.id,
            integration=slack_provider_integration,
            config={
                "toggleableFlags": {
                    SlackIntegration.ISSUE_ALERTS_THREAD_FLAG: False,
                    SlackIntegration.METRIC_ALERTS_THREAD_FLAG: False,
                }
            },
        )

        result = organization_integration_has_feature_enabled(
            slack_provider_integration,
            self.organization.id,
            SlackIntegration.ISSUE_ALERTS_THREAD_FLAG,
        )
        assert result is False

    def test_returns_true(self) -> None:
        slack_provider_integration = self.create_provider_integration(
            provider="slack", name="Slack", metadata={}
        )
        self.create_organization_integration(
            organization_id=self.organization.id,
            integration=slack_provider_integration,
            config={
                "toggleableFlags": {
                    SlackIntegration.ISSUE_ALERTS_THREAD_FLAG: False,
                    SlackIntegration.METRIC_ALERTS_THREAD_FLAG: True,
                }
            },
        )

        result = organization_integration_has_feature_enabled(
            slack_provider_integration,
            self.organization.id,
            SlackIntegration.METRIC_ALERTS_THREAD_FLAG,
        )
        assert result is True

    def test_returns_false_when_installation_does_not_exist(self) -> None:
        slack_provider_integration = self.create_provider_integration(
            provider="slack", name="Slack", metadata={}
        )

        result = organization_integration_has_feature_enabled(
            slack_provider_integration, self.organization.id, "foo"
        )
        assert result is False

    def test_returns_false_when_installation_is_not_slack(self) -> None:
        slack_provider_integration = self.create_provider_integration(
            provider="github", name="Github", metadata={}
        )

        result = organization_integration_has_feature_enabled(
            slack_provider_integration,
            self.organization.id,
            SlackIntegration.METRIC_ALERTS_THREAD_FLAG,
        )
        assert result is False

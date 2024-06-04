import pytest
from slack_sdk.errors import SlackApiError

from sentry.integrations.slack.sdk_client import SlackClient
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class SlackClientTest(TestCase):
    def setUp(self):
        self.access_token = "xoxb-access-token"
        self.integration, self.organization_integration = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            external_id="slack:1",
            provider="slack",
            metadata={"access_token": self.access_token},
        )

    def test_no_integration_found_error(self):
        with pytest.raises(ValueError):
            SlackClient(integration_id=2)

    def test_no_access_token_error(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(metadata={})

        with pytest.raises(ValueError):
            SlackClient(integration_id=self.integration.id)

    def test_authorize(self):
        client = SlackClient(integration_id=self.integration.id)

        with pytest.raises(SlackApiError):
            # error raised because it's actually trying to POST
            client.chat_postMessage(channel="#announcements", text="hello")

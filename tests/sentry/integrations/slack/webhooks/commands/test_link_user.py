from unittest.mock import patch

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.slack.views.link_identity import SUCCESS_LINKED_MESSAGE, build_linking_url
from sentry.integrations.slack.views.unlink_identity import (
    SUCCESS_UNLINKED_MESSAGE,
    build_unlinking_url,
)
from sentry.integrations.slack.webhooks.base import NOT_LINKED_MESSAGE
from sentry.integrations.types import EventLifecycleOutcome
from sentry.testutils.helpers import get_response_text
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity
from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest


@control_silo_test
class SlackLinkIdentityViewTest(SlackCommandsTest):
    """Slack Linking Views are returned on Control Silo"""

    def test_link_user_identity(self):
        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )

        response = self.client.post(linking_url)
        assert response.status_code == 200

        assert self.mock_webhook.call_count == 1
        text = self.mock_webhook.call_args.kwargs["text"]
        assert text == SUCCESS_LINKED_MESSAGE


class SlackCommandsLinkUserTest(SlackCommandsTest):
    """Slash commands results are generated on Region Silo"""

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_command(self, mock_record):
        data = self.send_slack_message("link")
        assert "Link your Slack identity" in get_response_text(data)

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_command_already_linked(self, mock_record):
        self.link_user()
        data = self.send_slack_message("link")
        assert "You are already linked as" in get_response_text(data)

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS


@control_silo_test
class SlackUnlinkIdentityViewTest(SlackCommandsTest):
    """Slack Linking Views are returned on Control Silo"""

    def test_unlink_user_identity_auth(self):
        self.link_user()

        unlinking_url = build_unlinking_url(
            self.integration.id,
            self.slack_id,
            self.external_id,
            self.response_url,
        )

        response = self.client.get(unlinking_url)
        assert response.status_code == 200
        assert (
            "Confirm that you'd like to unlink your Slack identity from your Sentry account."
            in response.content.decode("utf-8")
        )

    def test_unlink_user_identity(self):
        self.link_user()

        unlinking_url = build_unlinking_url(
            self.integration.id,
            self.slack_id,
            self.external_id,
            self.response_url,
        )

        response = self.client.post(unlinking_url)
        assert response.status_code == 200

        assert self.mock_webhook.call_count == 1
        text = self.mock_webhook.call_args.kwargs["text"]
        assert text == SUCCESS_UNLINKED_MESSAGE
        assert not Identity.objects.filter(external_id=self.slack_id).exists()

    def test_404(self):
        self.link_user()

        unlinking_url = build_unlinking_url(
            self.integration.id,
            self.slack_id,
            self.external_id,
            self.response_url,
        )

        OrganizationIntegration.objects.filter(integration_id=self.integration.id).delete()

        response = self.client.get(unlinking_url)
        assert response.status_code == 404

        response = self.client.post(unlinking_url)
        assert response.status_code == 404


class SlackCommandsUnlinkUserTest(SlackCommandsTest):
    """Slash commands results are generated on Region Silo"""

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink_command(self, mock_record):
        self.link_user()
        data = self.send_slack_message("unlink")
        assert "to unlink your identity" in get_response_text(data)

        assert len(mock_record.mock_calls) == 2
        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink_command_already_unlinked(self, mock_record):
        data = self.send_slack_message("unlink")
        assert NOT_LINKED_MESSAGE in get_response_text(data)

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

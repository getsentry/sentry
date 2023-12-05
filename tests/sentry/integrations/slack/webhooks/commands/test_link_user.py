import responses

from sentry.integrations.slack.views.link_identity import SUCCESS_LINKED_MESSAGE, build_linking_url
from sentry.integrations.slack.views.unlink_identity import (
    SUCCESS_UNLINKED_MESSAGE,
    build_unlinking_url,
)
from sentry.integrations.slack.webhooks.base import NOT_LINKED_MESSAGE
from sentry.testutils.helpers import get_response_text
from sentry.testutils.silo import control_silo_test, region_silo_test
from sentry.utils import json
from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest


@control_silo_test
class SlackLinkIdentityViewTest(SlackCommandsTest):
    """Slack Linking Views are returned on Control Silo"""

    @responses.activate
    def test_link_user_identity(self):
        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )

        response = self.client.post(linking_url)
        assert response.status_code == 200

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert SUCCESS_LINKED_MESSAGE in get_response_text(data)


@region_silo_test
class SlackCommandsLinkUserTest(SlackCommandsTest):
    """Slash commands results are generated on Region Silo"""

    @responses.activate
    def test_link_command(self):
        data = self.send_slack_message("link")
        assert "Link your Slack identity" in get_response_text(data)

    def test_link_command_already_linked(self):
        self.link_user()
        data = self.send_slack_message("link")
        assert "You are already linked as" in get_response_text(data)


@control_silo_test
class SlackUnlinkIdentityViewTest(SlackCommandsTest):
    """Slack Linking Views are returned on Control Silo"""

    @responses.activate
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

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert SUCCESS_UNLINKED_MESSAGE in get_response_text(data)


@region_silo_test
class SlackCommandsUnlinkUserTest(SlackCommandsTest):
    """Slash commands results are generated on Region Silo"""

    def test_unlink_command(self):
        self.link_user()
        data = self.send_slack_message("unlink")
        assert "to unlink your identity" in get_response_text(data)

    def test_unlink_command_already_unlinked(self):
        data = self.send_slack_message("unlink")
        assert NOT_LINKED_MESSAGE in get_response_text(data)

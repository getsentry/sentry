from typing import Any
from unittest.mock import MagicMock, patch

from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.notifications.platform.templates.seer import AGENT_OUT_OF_CREDITS_MEMBER_MESSAGE
from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest

TEAM_ID = "TXXXXXXX1"
UNAVAILABLE_MESSAGE = "Sentry can't notify your admins right now."


@patch("sentry.seer_credit.backend.request_top_up")
class SeerRequestCreditsTest(BaseEventTest):
    def get_action(self, organization_id: int | None = None) -> dict[str, Any]:
        return {
            "type": "button",
            "action_id": encode_action_id(
                action=SlackAction.SEER_REQUEST_CREDITS,
                organization_id=organization_id or self.organization.id,
                project_id=None,
            ),
            "block_id": "request_credits",
            "text": {"type": "plain_text", "text": "Contact Admin"},
        }

    def click(
        self, *, slack_user: dict[str, Any] | None = None, organization_id: int | None = None
    ) -> Any:
        action = self.get_action(organization_id)
        return self.post_webhook_block_kit(
            action_data=[action],
            slack_user=slack_user,
            original_message={
                "text": AGENT_OUT_OF_CREDITS_MEMBER_MESSAGE,
                "blocks": [
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": AGENT_OUT_OF_CREDITS_MEMBER_MESSAGE},
                    },
                    {"type": "actions", "elements": [action]},
                ],
            },
        )

    def test_asks_the_admins_and_replaces_the_button(self, mock_request_top_up: MagicMock) -> None:
        response = self.click()

        assert response.status_code == 200, response.content
        assert response.content == b""
        organization, requester = mock_request_top_up.call_args.args
        assert organization.id == self.organization.id
        assert requester.id == self.user.id

        update = self.mock_post.call_args.kwargs
        assert update["replace_original"] is True
        assert update["text"] == AGENT_OUT_OF_CREDITS_MEMBER_MESSAGE
        assert update["blocks"] == [
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": AGENT_OUT_OF_CREDITS_MEMBER_MESSAGE},
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ":white_check_mark: Your admins have been notified.",
                    }
                ],
            },
        ]

    def test_repeat_clicks_ask_the_admins_once(self, mock_request_top_up: MagicMock) -> None:
        self.click()
        self.click()

        assert mock_request_top_up.call_count == 1
        # The second notice still loses its button.
        assert self.mock_post.call_count == 2

    def test_each_member_can_ask(self, mock_request_top_up: MagicMock) -> None:
        other_member = self.create_user()
        self.create_member(organization=self.organization, user=other_member)
        self.create_identity(other_member, self.idp, "slack:2")

        self.click()
        self.click(slack_user={"id": "slack:2", "team_id": TEAM_ID})

        assert mock_request_top_up.call_count == 2

    def test_failed_request_can_be_retried(self, mock_request_top_up: MagicMock) -> None:
        mock_request_top_up.side_effect = [Exception("boom"), None]

        response = self.click()

        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == UNAVAILABLE_MESSAGE
        assert not self.mock_post.called

        response = self.click()

        assert response.content == b""
        assert mock_request_top_up.call_count == 2
        assert self.mock_post.call_count == 1

    def test_unlinked_user_gets_link_prompt(self, mock_request_top_up: MagicMock) -> None:
        response = self.click(slack_user={"id": "slack:unlinked", "team_id": TEAM_ID})

        assert response.status_code == 200
        assert "Link your identity now" in response.data["text"]
        assert response.data["response_type"] == "ephemeral"
        assert not mock_request_top_up.called

    def test_non_member_is_blocked(self, mock_request_top_up: MagicMock) -> None:
        non_member = self.create_user()
        self.create_identity(non_member, self.idp, "slack:2")

        response = self.click(slack_user={"id": "slack:2", "team_id": TEAM_ID})

        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == (
            f"You must be a member of the *{self.organization.name}* Sentry organization "
            "to contact its admins."
        )
        assert not mock_request_top_up.called
        assert not self.mock_post.called

    def test_organization_without_this_workspace_is_unavailable(
        self, mock_request_top_up: MagicMock
    ) -> None:
        other_organization = self.create_organization(owner=self.user)

        response = self.click(organization_id=other_organization.id)

        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == UNAVAILABLE_MESSAGE
        assert not mock_request_top_up.called
        assert not self.mock_post.called

from typing import Any
from unittest.mock import MagicMock, patch

from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from tests.sentry.integrations.slack.webhooks.actions import BaseEventTest

TEAM_ID = "TXXXXXXX1"
UNAVAILABLE_MESSAGE = "Sentry can't notify your admins right now."


@patch("sentry.seer_credit.backend.request_top_up", return_value=True)
class SeerRequestCreditsTest(BaseEventTest):
    def click(
        self, *, slack_user: dict[str, Any] | None = None, organization_id: int | None = None
    ) -> Any:
        return self.post_webhook_block_kit(
            action_data=[
                {
                    "type": "button",
                    "action_id": encode_action_id(
                        action=SlackAction.SEER_REQUEST_CREDITS,
                        organization_id=organization_id or self.organization.id,
                        project_id=None,
                    ),
                    "block_id": "request_credits",
                    "text": {"type": "plain_text", "text": "Contact Admin"},
                }
            ],
            slack_user=slack_user,
        )

    def test_asks_the_admins(self, mock_request_top_up: MagicMock) -> None:
        response = self.click()

        assert response.status_code == 200, response.content
        assert response.data["response_type"] == "ephemeral"
        assert response.data["replace_original"] is False
        assert response.data["text"] == ":white_check_mark: Your admins have been notified."
        organization, requester = mock_request_top_up.call_args.args
        assert organization.id == self.organization.id
        assert requester.id == self.user.id

    def test_member_who_already_asked_is_told_so(self, mock_request_top_up: MagicMock) -> None:
        mock_request_top_up.return_value = False

        response = self.click()

        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == "You've already asked your admins this billing period."

    def test_failed_request_is_unavailable(self, mock_request_top_up: MagicMock) -> None:
        mock_request_top_up.side_effect = Exception("boom")

        response = self.click()

        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == UNAVAILABLE_MESSAGE

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

    def test_organization_without_this_workspace_is_unavailable(
        self, mock_request_top_up: MagicMock
    ) -> None:
        other_organization = self.create_organization(owner=self.user)

        response = self.click(organization_id=other_organization.id)

        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == UNAVAILABLE_MESSAGE
        assert not mock_request_top_up.called

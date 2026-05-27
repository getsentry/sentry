from unittest.mock import patch

from sentry.testutils.silo import assume_test_silo_mode_of

from . import SEER_EXPLORER_FEATURES, BaseEventTest

BOT_USER_ID = "U0BOT"

REACTION_ADDED_EVENT = {
    "type": "reaction_added",
    "user": "U1234567890",
    "reaction": "+1",
    "item_user": BOT_USER_ID,
    "item": {
        "type": "message",
        "channel": "C1234567890",
        "ts": "1234567890.123456",
    },
    "event_ts": "1234567890.654321",
}
AUTHORIZATIONS_DATA = {"authorizations": [{"user_id": BOT_USER_ID, "is_bot": True}]}


class ReactionAddedEventTest(BaseEventTest):
    def setUp(self):
        super().setUp()
        with assume_test_silo_mode_of(type(self.integration)):
            self.integration.metadata["bot_user_id"] = BOT_USER_ID
            self.integration.save()
        self.link_identity(user=self.user, slack_user_id="U1234567890")

    @patch("sentry.seer.entrypoints.slack.tasks.process_reaction_for_slack.apply_async")
    def test_thumbs_reacts_dispatches_task(self, mock_process_reaction):
        event_data = {**REACTION_ADDED_EVENT, "reaction": "+1"}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_process_reaction.assert_called_once_with(
            kwargs={
                "integration_id": self.integration.id,
                "organization_id": self.organization.id,
                "channel_id": "C1234567890",
                "message_ts": "1234567890.123456",
                "reaction": "+1",
                "reactor_slack_user_id": "U1234567890",
            }
        )

        mock_process_reaction.reset_mock()
        event_data = {**REACTION_ADDED_EVENT, "reaction": "-1"}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        kwargs = mock_process_reaction.call_args[1]["kwargs"]
        assert kwargs["reaction"] == "-1"

    @patch("sentry.seer.entrypoints.slack.tasks.process_reaction_for_slack.apply_async")
    def test_supports_skin_tones(self, mock_process_reaction):
        event_data = {**REACTION_ADDED_EVENT, "reaction": "+1::skin-tone-5"}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_process_reaction.assert_called_once()

        mock_process_reaction.reset_mock()
        event_data = {**REACTION_ADDED_EVENT, "reaction": "-1::skin-tone-3"}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_process_reaction.assert_called_once()

    @patch("sentry.seer.entrypoints.slack.tasks.process_reaction_for_slack.apply_async")
    def test_unsupported_reaction_ignored(self, mock_process_reaction):
        event_data = {**REACTION_ADDED_EVENT, "reaction": "heart"}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_process_reaction.assert_not_called()

    @patch("sentry.seer.entrypoints.slack.tasks.process_reaction_for_slack.apply_async")
    def test_non_bot_message_ignored(self, mock_process_reaction):
        event_data = {**REACTION_ADDED_EVENT, "item_user": "U_ANOTHER_USER"}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_process_reaction.assert_not_called()

    @patch("sentry.seer.entrypoints.slack.tasks.process_reaction_for_slack.apply_async")
    def test_non_message_item_ignored(self, mock_process_reaction):
        event_data = {
            **REACTION_ADDED_EVENT,
            "item": {"type": "file", "file": "F1234567890"},
        }
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_process_reaction.assert_not_called()

    @patch("sentry.seer.entrypoints.slack.tasks.process_reaction_for_slack.apply_async")
    def test_no_item_user_does_not_dispatch(self, mock_process_reaction):
        """When item_user is absent, it won't match bot_user_id so we don't dispatch."""
        event_data = {k: v for k, v in REACTION_ADDED_EVENT.items() if k != "item_user"}
        with self.feature(SEER_EXPLORER_FEATURES):
            resp = self.post_webhook(event_data=event_data, data=AUTHORIZATIONS_DATA)

        assert resp.status_code == 200
        mock_process_reaction.assert_not_called()

from unittest.mock import patch

from sentry.silo.base import SiloMode
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity, IdentityStatus

from . import BaseEventTest

SLACK_USER_ID = "U789012"


class AppMentionEventTest(BaseEventTest):
    """Tests for handling app_mention events from Slack."""

    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.idp = self.create_identity_provider(type="slack", external_id="TXXXXXXX1")
            Identity.objects.create(
                external_id=SLACK_USER_ID,
                idp=self.idp,
                user=self.user,
                status=IdentityStatus.VALID,
                scopes=[],
            )

    def get_app_mention_event(
        self,
        *,
        channel: str = "C123456",
        user: str = SLACK_USER_ID,
        text: str = "<@UBOTID> help me with this issue",
        ts: str = "1234567890.123456",
        thread_ts: str | None = None,
    ) -> dict:
        event = {
            "type": "app_mention",
            "channel": channel,
            "user": user,
            "text": text,
            "ts": ts,
        }
        if thread_ts:
            event["thread_ts"] = thread_ts
        return event

    def test_app_mention_without_feature_flag_returns_200(self):
        event_data = self.get_app_mention_event()
        resp = self.post_webhook(event_data=event_data)
        assert resp.status_code == 200

    @with_feature("organizations:seer-slack-explorer")
    def test_app_mention_with_feature_flag_returns_200(self):
        event_data = self.get_app_mention_event()
        resp = self.post_webhook(event_data=event_data)
        assert resp.status_code == 200

    @with_feature("organizations:seer-slack-explorer")
    @patch("sentry.integrations.slack.webhooks.event._logger")
    def test_app_mention_logs_event_data(self, mock_logger):
        event_data = self.get_app_mention_event(
            channel="C999",
            ts="111.222",
            thread_ts="333.444",
        )
        resp = self.post_webhook(event_data=event_data)
        assert resp.status_code == 200

        # Find the "received" log call
        received_calls = [
            c for c in mock_logger.info.call_args_list if c[0][0] == "slack.app_mention.received"
        ]
        assert len(received_calls) == 1
        extra = received_calls[0][1]["extra"]
        assert extra["channel_id"] == "C999"
        assert extra["user_id"] == SLACK_USER_ID
        assert extra["message_ts"] == "111.222"
        assert extra["thread_ts"] == "333.444"
        assert extra["sentry_user_id"] == self.user.id
        assert self.organization.id in extra["organization_ids"]

    @with_feature("organizations:seer-slack-explorer")
    def test_app_mention_in_thread(self):
        event_data = self.get_app_mention_event(thread_ts="1234567890.000000")
        resp = self.post_webhook(event_data=event_data)
        assert resp.status_code == 200

    def test_app_mention_no_organization_returns_200(self):
        with patch(
            "sentry.integrations.slack.webhooks.event.integration_service.get_organization_integrations",
            return_value=[],
        ):
            event_data = self.get_app_mention_event()
            resp = self.post_webhook(event_data=event_data)
            assert resp.status_code == 200

    @patch("sentry.integrations.slack.webhooks.event._logger")
    def test_app_mention_no_identity_returns_200(self, mock_logger):
        """Unlinked Slack user should be rejected."""
        event_data = self.get_app_mention_event(user="UUNKNOWN")
        resp = self.post_webhook(event_data=event_data)
        assert resp.status_code == 200

        no_identity_calls = [
            c for c in mock_logger.info.call_args_list if c[0][0] == "slack.app_mention.no_identity"
        ]
        assert len(no_identity_calls) == 1

    @with_feature("organizations:seer-slack-explorer")
    @patch("sentry.integrations.slack.webhooks.event._logger")
    def test_app_mention_finds_all_enabled_orgs(self, mock_logger):
        """Should collect all orgs that have the feature flag enabled."""
        second_org = self.create_organization(name="Second Org", owner=self.user)
        self.create_organization_integration(
            organization_id=second_org.id,
            integration=self.integration,
        )

        event_data = self.get_app_mention_event()
        resp = self.post_webhook(event_data=event_data)
        assert resp.status_code == 200

        received_calls = [
            c for c in mock_logger.info.call_args_list if c[0][0] == "slack.app_mention.received"
        ]
        assert len(received_calls) == 1
        org_ids = received_calls[0][1]["extra"]["organization_ids"]
        assert self.organization.id in org_ids
        assert second_org.id in org_ids

from unittest import mock
from unittest.mock import MagicMock, patch

import orjson
import responses
from slack_sdk.errors import SlackApiError
from slack_sdk.web.slack_response import SlackResponse

from sentry.analytics.events.alert_sent import AlertSentEvent
from sentry.constants import ObjectStatus
from sentry.integrations.slack import SlackNotifyServiceAction
from sentry.integrations.slack.analytics import SlackIntegrationNotificationSent
from sentry.integrations.slack.utils.constants import SLACK_RATE_LIMITED_MESSAGE
from sentry.integrations.types import ExternalProviders
from sentry.notifications.additional_attachment_manager import manager
from sentry.silo.base import SiloMode
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.analytics import (
    assert_any_analytics_event,
    assert_last_analytics_event,
)
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from tests.sentry.integrations.slack.test_notifications import (
    additional_attachment_generator_block_kit,
)
from tests.sentry.integrations.slack.utils.test_mock_slack_response import mock_slack_response

pytestmark = [requires_snuba]


class SlackNotifyActionTest(RuleTestCase):
    rule_cls = SlackNotifyServiceAction

    def mock_list(self, list_type, channels, result_name="channels"):
        return mock_slack_response(f"{list_type}_list", body={"ok": True, result_name: channels})

    def mock_conversations_info(self, channel):
        return mock_slack_response(
            "conversations_info",
            body={"ok": True, "channel": channel},
            req_args={"channel": channel},
        )

    def mock_msg_schedule_response(self, channel_id, result_name="channel"):
        if channel_id == "channel_not_found":
            body = {"ok": False, "error": "channel_not_found"}
        else:
            body = {
                "ok": True,
                result_name: channel_id,
                "scheduled_message_id": "Q1298393284",
            }
        return mock_slack_response("chat_scheduleMessage", body)

    def mock_msg_delete_scheduled_response(self, channel_id, result_name="channel"):
        return mock_slack_response("chat_deleteScheduledMessage", {"ok": True})

    def setUp(self) -> None:
        self.organization = self.get_event().project.organization
        self.integration, self.org_integration = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "domain_name": "sentry.slack.com",
                "installation_type": "born_as_bot",
            },
            name="Awesome Team",
            provider="slack",
        )

    def assert_form_valid(self, form, expected_channel_id, expected_channel):
        assert form.is_valid()
        assert form.cleaned_data["channel_id"] == expected_channel_id
        assert form.cleaned_data["channel"] == expected_channel

    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    @patch(
        "slack_sdk.web.client.WebClient._perform_urllib_http_request",
        return_value={
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        },
    )
    def test_no_upgrade_notice_bot_app(
        self, mock_api_call: MagicMock, mock_post: MagicMock
    ) -> None:
        event = self.get_event()

        rule = self.get_rule(data={"workspace": self.integration.id, "channel": "#my-channel"})

        results = list(rule.after(event=event))
        assert len(results) == 1

        # Trigger rule callback
        results[0].callback(event, futures=[])

        blocks = mock_post.call_args.kwargs["blocks"]
        blocks = orjson.loads(blocks)

        assert event.title in blocks[0]["text"]["text"]

    def test_render_label_with_notes(self) -> None:
        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-channel",
                "channel_id": "",
                "tags": "one, two",
                "notes": "fix this @colleen",
            }
        )

        assert (
            rule.render_label()
            == 'Send a notification to the Awesome Team Slack workspace to #my-channel and show tags [one, two] and notes "fix this @colleen" in notification'
        )

    def test_render_label_without_integration(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()

        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-channel",
                "channel_id": "",
                "tags": "",
            }
        )

        label = rule.render_label()
        assert label == "Send a notification to the [removed] Slack workspace to #my-channel"

    @responses.activate
    def test_valid_bot_channel_selected(self) -> None:
        integration, _ = self.create_provider_integration_for(
            organization=self.event.project.organization,
            user=self.user,
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX2",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "domain_name": "sentry.slack.com",
                "installation_type": "born_as_bot",
            },
        )
        rule = self.get_rule(
            data={"workspace": integration.id, "channel": "#my-channel", "tags": ""}
        )

        with self.mock_msg_schedule_response("chan-id"):
            with self.mock_msg_delete_scheduled_response("chan-id"):
                form = rule.get_form_instance()
                assert form.is_valid()
                self.assert_form_valid(form, "chan-id", "#my-channel")

    @responses.activate
    def test_valid_member_selected(self) -> None:
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "@morty", "tags": ""}
        )

        members = {
            "ok": "true",
            "members": [
                {"name": "morty", "id": "morty-id"},
                {"name": "other-user", "id": "user-id"},
            ],
        }

        with self.mock_msg_schedule_response("channel_not_found"):
            with self.mock_list("users", members["members"], "members"):
                form = rule.get_form_instance()
                assert form.is_valid()
                self.assert_form_valid(form, "morty-id", "@morty")

    @responses.activate
    def test_invalid_channel_selected(self) -> None:
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "#my-channel", "tags": ""}
        )

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=orjson.dumps({"ok": False, "error": "channel_not_found"}),
        )

        members = {"ok": "true", "members": [{"name": "other-member", "id": "member-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=200,
            content_type="application/json",
            body=orjson.dumps(members),
        )

        form = rule.get_form_instance()

        assert not form.is_valid()
        assert len(form.errors) == 1

    @responses.activate
    @patch("slack_sdk.web.client.WebClient.users_list")
    def test_rate_limited_response(self, mock_api_call: MagicMock) -> None:
        """Should surface a 429 from Slack to the frontend form"""

        mock_api_call.side_effect = SlackApiError(
            message="ratelimited",
            response=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/users.list",
                req_args={},
                data={"ok": False, "error": "rate_limited"},
                headers={},
                status_code=429,
            ),
        )

        with self.mock_msg_schedule_response("channel_not_found"):
            rule = self.get_rule(
                data={
                    "workspace": self.integration.id,
                    "channel": "#my-channel",
                    "input_channel_id": "",
                    "tags": "",
                }
            )

            form = rule.get_form_instance()
            assert not form.is_valid()
            assert SLACK_RATE_LIMITED_MESSAGE in str(form.errors.values())

    def test_channel_id_provided_sdk(self) -> None:
        channel = {"name": "my-channel", "id": "C2349874"}
        with self.mock_conversations_info(channel):
            rule = self.get_rule(
                data={
                    "workspace": self.integration.id,
                    "channel": "#my-channel",
                    "input_channel_id": "C2349874",
                    "tags": "",
                }
            )

            form = rule.get_form_instance()
            assert form.is_valid()

    def test_channel_id_as_channel_name_auto_corrected(self) -> None:
        """
        Test that when a user provides a channel ID as the channel name,
        the form auto-corrects it to the actual channel name from Slack.
        This is for issue #105478.
        """
        # User mistakenly puts the channel ID in the channel name field
        channel = {"name": "public", "id": "C013TMFDEAV"}
        with self.mock_conversations_info(channel):
            rule = self.get_rule(
                data={
                    "workspace": self.integration.id,
                    "channel": "#C013TMFDEAV",
                    "input_channel_id": "C013TMFDEAV",
                    "tags": "",
                }
            )

            form = rule.get_form_instance()
            # Form should be valid and auto-correct the channel name
            self.assert_form_valid(form, "C013TMFDEAV", "#public")

    def test_user_id_as_channel_name_auto_corrected(self) -> None:
        """
        Test that when a user provides a User ID as the channel name,
        the form auto-corrects it to the actual username with @ prefix.
        """
        # User mistakenly puts the User ID in the channel name field
        user = {"name": "morty", "id": "U1234567"}
        with self.mock_conversations_info(user):
            rule = self.get_rule(
                data={
                    "workspace": self.integration.id,
                    "channel": "U1234567",
                    "input_channel_id": "U1234567",
                    "tags": "",
                }
            )

            form = rule.get_form_instance()
            # Form should be valid and auto-correct to @morty
            # Note: The mock helpers in this test file might behave differently for users vs channels
            # We need to ensure mock_conversations_info mocks user lookup correctly or use a different mock

            # The validate_user_id calls client.users_info.
            # mock_conversations_info mocks conversations_info BUT validate_slack_entity_id
            # will call validate_user_id if ID starts with U, which calls users_info.
            # So we need to mock users_info.

            with patch(
                "slack_sdk.web.client.WebClient.users_info",
                return_value={
                    "ok": True,
                    "user": {"name": "morty", "profile": {"display_name": "Morty Smith"}},
                },
            ):
                self.assert_form_valid(form, "U1234567", "@morty")

    def test_invalid_channel_id_provided_sdk(self) -> None:
        with patch(
            "slack_sdk.web.client.WebClient.conversations_info",
            side_effect=SlackApiError("", response={"ok": False, "error": "channel_not_found"}),
        ):
            rule = self.get_rule(
                data={
                    "workspace": self.integration.id,
                    "channel": "#my-chanel",
                    "input_channel_id": "C1234567",
                    "tags": "",
                }
            )

            form = rule.get_form_instance()
            assert not form.is_valid()
            assert "Channel not found. Invalid ID provided." in str(form.errors.values())

    def test_mismatched_channel_name_auto_corrected(self) -> None:
        """
        Test that when the user-provided channel name doesn't match the actual name from Slack,
        the form auto-corrects it to the actual channel name (instead of raising an error).
        This is part of the fix for issue #105478.
        """
        channel = {"name": "my-channel", "id": "C2349874"}
        with self.mock_conversations_info(channel):
            rule = self.get_rule(
                data={
                    "workspace": self.integration.id,
                    "channel": "#my-chanel",  # User typed wrong name
                    "input_channel_id": "C2349874",
                    "tags": "",
                }
            )

            form = rule.get_form_instance()
            # Form should be valid and auto-correct the channel name
            self.assert_form_valid(form, "C2349874", "#my-channel")

    def test_invalid_workspace(self) -> None:
        # the workspace _should_ be the integration id

        rule = self.get_rule(data={"workspace": "unknown", "channel": "#my-channel", "tags": ""})

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert ["Slack: Workspace is a required field."] in form.errors.values()

    @responses.activate
    def test_display_name_conflict(self) -> None:
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "@morty", "tags": ""}
        )

        members = {
            "ok": "true",
            "members": [
                {"name": "first-morty", "id": "morty-id", "profile": {"display_name": "morty"}},
                {"name": "second-morty", "id": "user-id", "profile": {"display_name": "morty"}},
            ],
        }

        with self.mock_msg_schedule_response("channel_not_found"):
            with self.mock_list("users", members["members"], "members"):
                form = rule.get_form_instance()
                assert not form.is_valid()
                assert [
                    "Slack: Multiple users were found with display name '@morty'. Please use your username, found at sentry.slack.com/account/settings#username."
                ] in form.errors.values()

    def test_disabled_org_integration(self) -> None:
        org = self.create_organization(owner=self.user)
        self.create_organization_integration(
            organization_id=org.id, integration=self.integration, status=ObjectStatus.DISABLED
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org_integration.update(status=ObjectStatus.DISABLED)
        event = self.get_event()

        rule = self.get_rule(data={"workspace": self.integration.id, "channel": "#my-channel"})

        results = list(rule.after(event=event))
        assert len(results) == 0

    @responses.activate
    @mock.patch("sentry.analytics.record")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    @patch(
        "slack_sdk.web.client.WebClient._perform_urllib_http_request",
        return_value={
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        },
    )
    def test_additional_attachment(
        self, mock_api_call: MagicMock, mock_post: MagicMock, mock_record: MagicMock
    ) -> None:
        with mock.patch.dict(
            manager.attachment_generators,
            {ExternalProviders.SLACK: additional_attachment_generator_block_kit},
        ):
            event = self.get_event()

            rule = self.get_rule(
                data={
                    "workspace": self.integration.id,
                    "channel": "#my-channel",
                    "channel_id": "123",
                }
            )

            notification_uuid = "123e4567-e89b-12d3-a456-426614174000"
            results = list(rule.after(event=event, notification_uuid=notification_uuid))
            assert len(results) == 1

            # Trigger rule callback
            results[0].callback(event, futures=[])
            blocks = mock_post.call_args.kwargs["blocks"]
            blocks = orjson.loads(blocks)

            assert event.title in blocks[0]["text"]["text"]
            assert blocks[5]["text"]["text"] == self.organization.slug
            assert blocks[6]["text"]["text"] == self.integration.id
            assert_last_analytics_event(
                mock_record,
                AlertSentEvent(
                    provider="slack",
                    alert_id="",
                    alert_type="issue_alert",
                    organization_id=self.organization.id,
                    project_id=event.project_id,
                    external_id="123",
                    notification_uuid=notification_uuid,
                ),
            )
            assert_any_analytics_event(
                mock_record,
                SlackIntegrationNotificationSent(
                    category="issue_alert",
                    organization_id=self.organization.id,
                    project_id=event.project_id,
                    group_id=event.group_id,
                    notification_uuid=notification_uuid,
                    alert_id=None,
                ),
            )

    @responses.activate
    def test_multiple_integrations(self) -> None:
        org = self.create_organization(owner=self.user)
        self.create_organization_integration(organization_id=org.id, integration=self.integration)

        event = self.get_event()

        rule = self.get_rule(data={"workspace": self.integration.id, "channel": "#my-channel"})

        results = list(rule.after(event=event))
        assert len(results) == 1

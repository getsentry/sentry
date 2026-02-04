from unittest.mock import ANY, Mock, patch

from fixtures.seer.webhooks import MOCK_RUN_ID, MOCK_SEER_WEBHOOKS
from sentry.constants import ENABLE_SEER_CODING_DEFAULT
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.notifications.platform.service import NotificationDataDto
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import SeerAutofixUpdate
from sentry.notifications.utils.actions import BlockKitMessageAction
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.integrations.slack import (
    SlackEntrypoint,
    SlackEntrypointCachePayload,
    SlackThreadDetails,
    handle_prepare_autofix_update,
    process_thread_update,
    schedule_all_thread_updates,
    send_thread_update,
    update_existing_message,
)
from sentry.testutils.cases import TestCase


class SlackEntrypointTest(TestCase):
    def setUp(self):
        self.slack_user_id = "UXXXXXXXXX1"
        self.channel_id = "CXXXXXXXXX1"
        self.thread_ts = "1712345678.987654"
        self.thread = SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="TXXXXXXXXX1",
            provider="slack",
        )
        self.slack_request = Mock()
        self.slack_request.integration = self.integration
        self.slack_request.channel_id = self.channel_id
        self.slack_request.user_id = self.slack_user_id
        self.slack_request.data = {"message": {"ts": self.thread_ts}}
        self.action = BlockKitMessageAction(
            name=SlackAction.SEER_AUTOFIX_START.value,
            label="Fix with Seer",
            action_id=SlackAction.SEER_AUTOFIX_START.value,
            value=AutofixStoppingPoint.ROOT_CAUSE.value,
        )

    def _get_entrypoint(self) -> SlackEntrypoint:
        return SlackEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
            action=self.action,
        )

    def test_has_access(self):
        with self.feature("organizations:seer-slack-workflows"):
            assert SlackEntrypoint.has_access(self.organization)
        with self.feature({"organizations:seer-slack-workflows": False}):
            assert not SlackEntrypoint.has_access(self.organization)

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_autofix_error(self, mock_send_threaded_ephemeral_message):
        ep = self._get_entrypoint()
        ep.on_trigger_autofix_error(error="Test error")
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_request.user_id,
        )

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_on_trigger_autofix_success(self, mock_update_message):
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [],
            }
        }
        ep = self._get_entrypoint()
        ep.on_trigger_autofix_success(run_id=MOCK_RUN_ID)
        mock_update_message.assert_called_once()

    def test_create_autofix_cache_payload(self):
        ep = self._get_entrypoint()
        cache_payload = ep.create_autofix_cache_payload()
        SlackEntrypointCachePayload(**cache_payload)
        assert cache_payload["group_link"] == SlackEntrypoint.get_group_link(self.group)
        assert cache_payload["organization_id"] == self.organization.id
        assert cache_payload["integration_id"] == self.integration.id
        assert cache_payload["project_id"] == self.group.project.id
        assert cache_payload["group_id"] == self.group.id
        assert cache_payload["threads"] == [self.thread]

    @patch("sentry.seer.entrypoints.integrations.slack.schedule_all_thread_updates")
    def test_on_autofix_update(self, mock_schedule_all_thread_updates):
        ep = self._get_entrypoint()
        for event_type, event_payload in MOCK_SEER_WEBHOOKS.items():
            cache_payload = ep.create_autofix_cache_payload()
            ep.on_autofix_update(
                event_type=event_type, event_payload=event_payload, cache_payload=cache_payload
            )
            mock_schedule_all_thread_updates.assert_called_with(
                threads=cache_payload["threads"],
                integration_id=cache_payload["integration_id"],
                organization_id=cache_payload["organization_id"],
                data=ANY,
            )

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_message")
    def test_send_thread_update(
        self, mock_send_threaded_message, mock_send_threaded_ephemeral_message
    ):
        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.SOLUTION,
            group_link=self.group.get_absolute_url(),
        )
        install = self.integration.get_installation(organization_id=self.organization.id)

        send_thread_update(install=install, thread=self.thread, data=data)
        mock_send_threaded_message.assert_called_with(
            channel_id=self.thread["channel_id"],
            thread_ts=self.thread["thread_ts"],
            renderable=ANY,
        )
        mock_send_threaded_ephemeral_message.assert_not_called()

        mock_send_threaded_message.reset_mock()
        send_thread_update(
            install=install,
            thread=self.thread,
            data=data,
            ephemeral_user_id=self.slack_user_id,
        )
        mock_send_threaded_message.assert_not_called()
        mock_send_threaded_ephemeral_message.assert_called_with(
            channel_id=self.thread["channel_id"],
            thread_ts=self.thread["thread_ts"],
            renderable=ANY,
            slack_user_id=self.slack_user_id,
        )

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message(self, mock_update_message):
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [
                    {"type": "section", "text": {"type": "plain_text", "text": "Issue found"}},
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "action_id": "seer_autofix_start",
                                "value": AutofixStoppingPoint.SOLUTION.value,
                                "text": {"type": "plain_text", "text": "Plan a Solution"},
                            },
                            {
                                "type": "button",
                                "action_id": "other_action",
                                "text": {"type": "plain_text", "text": "Other Action"},
                            },
                        ],
                    },
                ],
            }
        }

        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.ROOT_CAUSE,
            group_link=self.group.get_absolute_url(),
            has_progressed=True,
        )
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            slack_user_id=self.slack_user_id,
        )

        mock_update_message.assert_called_once()
        call_args = mock_update_message.call_args
        assert call_args.kwargs["channel_id"] == self.channel_id
        assert call_args.kwargs["message_ts"] == self.thread_ts
        renderable = call_args.kwargs["renderable"]
        # Original section block + actions block (with non-autofix button) + footer section + footer context
        assert len(renderable["blocks"]) == 4
        # The second block is an ActionsBlock with only the non-autofix button remaining
        actions_block = renderable["blocks"][1]
        assert len(actions_block.elements) == 1
        assert actions_block.elements[0].action_id == "other_action"

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_on_trigger_autofix_success_updates_message(self, mock_update_message):
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "action_id": "seer_autofix_start",
                                "value": AutofixStoppingPoint.SOLUTION.value,
                                "text": {"type": "plain_text", "text": "Plan a Solution"},
                            },
                        ],
                    }
                ],
            }
        }

        ep = self._get_entrypoint()
        ep.on_trigger_autofix_success(run_id=MOCK_RUN_ID)

        mock_update_message.assert_called_once()

    def test_get_autofix_lock_key(self):
        lock_key = SlackEntrypoint.get_autofix_lock_key(
            group_id=self.group.id,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )
        assert lock_key is not None
        assert "autofix:entrypoint:slack" in lock_key
        assert str(self.group.id) in lock_key
        assert AutofixStoppingPoint.ROOT_CAUSE.value in lock_key

    @patch("sentry.seer.entrypoints.integrations.slack.process_thread_update")
    def test_schedule_all_thread_updates(self, mock_process_thread_update):
        threads = [
            SlackThreadDetails(thread_ts="1234567890.123456", channel_id="C1234567890"),
            SlackThreadDetails(thread_ts="1234567890.654321", channel_id="C0987654321"),
        ]
        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.SOLUTION,
            group_link=self.group.get_absolute_url(),
        )

        schedule_all_thread_updates(
            threads=threads,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            data=data,
        )

        assert mock_process_thread_update.apply_async.call_count == len(threads)

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_message")
    def test_process_thread_update(self, mock_send_threaded_message):
        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.SOLUTION,
            group_link=self.group.get_absolute_url(),
        )

        serialized_data = NotificationDataDto(notification_data=data).to_dict()

        process_thread_update(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            thread=self.thread,
            serialized_data=serialized_data,
        )

        mock_send_threaded_message.assert_called_once_with(
            channel_id=self.thread["channel_id"],
            thread_ts=self.thread["thread_ts"],
            renderable=ANY,
        )

    @patch(
        "sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.get")
    def test_handle_prepare_autofix_update_empty_cache(self, mock_cache_get, mock_populate_cache):
        mock_cache_get.return_value = None
        mock_populate_cache.return_value = {"key": "test_key", "source": "group_id"}

        handle_prepare_autofix_update(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            group=self.group,
        )

        mock_populate_cache.assert_called_once()
        call_kwargs = mock_populate_cache.call_args.kwargs
        cache_payload = call_kwargs["cache_payload"]
        assert len(cache_payload["threads"]) == 1
        assert cache_payload["threads"][0]["thread_ts"] == self.thread_ts
        assert cache_payload["threads"][0]["channel_id"] == self.channel_id

    @patch(
        "sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.get")
    def test_handle_prepare_autofix_update_merges_threads(
        self, mock_cache_get, mock_populate_cache
    ):
        existing_thread = SlackThreadDetails(
            thread_ts="9876543210.123456", channel_id="CEXISTING00"
        )
        mock_cache_get.return_value = {
            "payload": {"threads": [existing_thread]},
            "source": "group_id",
            "key": "test_key",
        }
        mock_populate_cache.return_value = {"key": "test_key", "source": "group_id"}

        handle_prepare_autofix_update(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            group=self.group,
        )

        mock_populate_cache.assert_called_once()
        call_kwargs = mock_populate_cache.call_args.kwargs
        cache_payload = call_kwargs["cache_payload"]
        assert len(cache_payload["threads"]) == 2
        assert existing_thread in cache_payload["threads"]
        new_thread = SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)
        assert new_thread in cache_payload["threads"]

    @patch(
        "sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.get")
    def test_handle_prepare_autofix_update_no_duplicate_threads(
        self, mock_cache_get, mock_populate_cache
    ):
        existing_thread = SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)
        mock_cache_get.return_value = {
            "payload": {"threads": [existing_thread]},
            "source": "group_id",
            "key": "test_key",
        }

        handle_prepare_autofix_update(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            group=self.group,
        )

        mock_populate_cache.assert_called_once()
        call_kwargs = mock_populate_cache.call_args.kwargs
        cache_payload = call_kwargs["cache_payload"]
        assert len(cache_payload["threads"]) == 1

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message_removes_all_buttons_for_non_root_cause(
        self, mock_update_message
    ):
        """Test that non-ROOT_CAUSE stopping points remove all buttons."""
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [
                    {"type": "section", "text": {"type": "plain_text", "text": "Issue found"}},
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "action_id": "seer_autofix_start",
                                "value": AutofixStoppingPoint.SOLUTION.value,
                                "text": {"type": "plain_text", "text": "Plan a Solution"},
                            },
                            {
                                "type": "button",
                                "action_id": "other_action",
                                "text": {"type": "plain_text", "text": "Other Action"},
                            },
                        ],
                    },
                ],
            }
        }

        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.SOLUTION,
            group_link=self.group.get_absolute_url(),
            has_progressed=True,
        )
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            slack_user_id=self.slack_user_id,
        )
        mock_update_message.assert_called_once()
        call_args = mock_update_message.call_args
        renderable: SlackRenderable = call_args.kwargs["renderable"]
        # Original section block + footer section + footer context (actions block removed entirely)
        assert len(renderable["blocks"]) == 3
        # No actions block with buttons
        for block in renderable["blocks"]:
            assert block.type != "actions"

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message_without_slack_user_id(self, mock_update_message):
        """Test update_existing_message when slack_user_id is None."""
        self.slack_request.data = {
            "message": {
                "ts": self.thread_ts,
                "text": "Issue notification",
                "blocks": [],
            }
        }

        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.ROOT_CAUSE,
            group_link=self.group.get_absolute_url(),
            has_progressed=True,
        )
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            slack_user_id=None,
        )

        mock_update_message.assert_called_once()

    @patch("sentry.seer.entrypoints.integrations.slack.schedule_all_thread_updates")
    @patch("sentry.seer.entrypoints.integrations.slack.organization_service.get_option")
    def test_on_autofix_update_solution_coding_check(
        self, mock_get_option, mock_schedule_all_thread_updates
    ):
        """Test that has_progressed is True when coding is enabled for solution updates."""
        from sentry.sentry_apps.metrics import SentryAppEventType

        ep = self._get_entrypoint()
        cache_payload = ep.create_autofix_cache_payload()
        event_payload = {
            "run_id": 123,
            "group_id": self.group.id,
            "solution": {"description": "Test", "steps": []},
        }

        # Seer has coding enabled...
        mock_get_option.return_value = True
        ep.on_autofix_update(
            event_type=SentryAppEventType.SEER_SOLUTION_COMPLETED,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

        mock_get_option.assert_called_once_with(
            organization_id=self.organization.id,
            key="sentry:enable_seer_coding",
        )
        mock_schedule_all_thread_updates.assert_called_once()
        data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert data.has_progressed is True

        # Seer has coding disabled...
        mock_get_option.reset_mock()
        mock_schedule_all_thread_updates.reset_mock()
        mock_get_option.return_value = False
        ep.on_autofix_update(
            event_type=SentryAppEventType.SEER_SOLUTION_COMPLETED,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

        mock_get_option.assert_called_once_with(
            organization_id=self.organization.id,
            key="sentry:enable_seer_coding",
        )
        mock_schedule_all_thread_updates.assert_called_once()
        data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert data.has_progressed is False

        # Seer has no coding setting...
        mock_get_option.reset_mock()
        mock_schedule_all_thread_updates.reset_mock()
        mock_get_option.return_value = None
        ep.on_autofix_update(
            event_type=SentryAppEventType.SEER_SOLUTION_COMPLETED,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

        mock_get_option.assert_called_once_with(
            organization_id=self.organization.id,
            key="sentry:enable_seer_coding",
        )
        mock_schedule_all_thread_updates.assert_called_once()
        data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert data.has_progressed is ENABLE_SEER_CODING_DEFAULT

    @patch("sentry.seer.entrypoints.integrations.slack.schedule_all_thread_updates")
    @patch("sentry.seer.entrypoints.integrations.slack.organization_service.get_option")
    def test_on_autofix_update_solution_with_automation_stopping_point_skips_coding_check(
        self, mock_get_option, mock_schedule_all_thread_updates
    ):
        """Test that coding check is skipped when automation_stopping_point is set."""
        from sentry.sentry_apps.metrics import SentryAppEventType

        ep = self._get_entrypoint()
        cache_payload = ep.create_autofix_cache_payload()
        cache_payload["automation_stopping_point"] = AutofixStoppingPoint.SOLUTION
        event_payload = {
            "run_id": 123,
            "group_id": self.group.id,
            "solution": {"description": "Test", "steps": []},
        }

        ep.on_autofix_update(
            event_type=SentryAppEventType.SEER_SOLUTION_COMPLETED,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

        mock_get_option.assert_not_called()
        mock_schedule_all_thread_updates.assert_called_once()
        call_kwargs = mock_schedule_all_thread_updates.call_args.kwargs
        data = call_kwargs["data"]
        assert data.has_progressed is False

    def test_get_autofix_stopping_point_from_action_empty_value(self):
        """Test that empty value returns ROOT_CAUSE."""
        action = BlockKitMessageAction(
            name=SlackAction.SEER_AUTOFIX_START.value,
            label="Fix with Seer",
            action_id=SlackAction.SEER_AUTOFIX_START.value,
            value="",
        )
        result = SlackEntrypoint.get_autofix_stopping_point_from_action(
            action=action, group_id=self.group.id
        )
        assert result == AutofixStoppingPoint.ROOT_CAUSE

    def test_get_autofix_stopping_point_from_action_none_value(self):
        """Test that None value returns ROOT_CAUSE."""
        action = BlockKitMessageAction(
            name=SlackAction.SEER_AUTOFIX_START.value,
            label="Fix with Seer",
            action_id=SlackAction.SEER_AUTOFIX_START.value,
            value=None,
        )
        result = SlackEntrypoint.get_autofix_stopping_point_from_action(
            action=action, group_id=self.group.id
        )
        assert result == AutofixStoppingPoint.ROOT_CAUSE

    def test_get_autofix_stopping_point_from_action_valid_value(self):
        """Test that valid value returns correct stopping point."""
        action = BlockKitMessageAction(
            name=SlackAction.SEER_AUTOFIX_START.value,
            label="Plan a Solution",
            action_id=SlackAction.SEER_AUTOFIX_START.value,
            value=AutofixStoppingPoint.SOLUTION.value,
        )
        result = SlackEntrypoint.get_autofix_stopping_point_from_action(
            action=action, group_id=self.group.id
        )
        assert result == AutofixStoppingPoint.SOLUTION

    def test_get_autofix_stopping_point_from_action_invalid_value(self):
        """Test that invalid value returns ROOT_CAUSE with warning."""
        action = BlockKitMessageAction(
            name=SlackAction.SEER_AUTOFIX_START.value,
            label="Fix with Seer",
            action_id=SlackAction.SEER_AUTOFIX_START.value,
            value="invalid_stopping_point",
        )
        result = SlackEntrypoint.get_autofix_stopping_point_from_action(
            action=action, group_id=self.group.id
        )
        assert result == AutofixStoppingPoint.ROOT_CAUSE

    def test_get_group_link_includes_seer_drawer(self):
        """Test that get_group_link includes seerDrawer=true parameter."""
        link = SlackEntrypoint.get_group_link(self.group)
        assert "seerDrawer=true" in link
        assert str(self.group.id) in link or self.group.get_absolute_url() in link

    @patch(
        "sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.get")
    @patch("sentry.seer.entrypoints.integrations.slack.get_automation_stopping_point")
    @patch("sentry.seer.entrypoints.integrations.slack.is_group_triggering_automation")
    def test_handle_prepare_autofix_update_sets_automation_stopping_point(
        self, mock_is_triggering, mock_get_stopping_point, mock_cache_get, mock_populate_cache
    ):
        """Test that automation_stopping_point is set when group is triggering automation."""
        mock_cache_get.return_value = None
        mock_is_triggering.return_value = True
        mock_get_stopping_point.return_value = AutofixStoppingPoint.SOLUTION

        handle_prepare_autofix_update(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            group=self.group,
        )

        mock_populate_cache.assert_called_once()
        call_kwargs = mock_populate_cache.call_args.kwargs
        cache_payload = call_kwargs["cache_payload"]
        assert cache_payload["automation_stopping_point"] == AutofixStoppingPoint.SOLUTION

    @patch(
        "sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.integrations.slack.SeerOperatorAutofixCache.get")
    @patch("sentry.seer.entrypoints.integrations.slack.is_group_triggering_automation")
    def test_handle_prepare_autofix_update_no_automation_stopping_point(
        self, mock_is_triggering, mock_cache_get, mock_populate_cache
    ):
        """Test that automation_stopping_point is None when group is not triggering automation."""
        mock_cache_get.return_value = None
        mock_is_triggering.return_value = False

        handle_prepare_autofix_update(
            thread_ts=self.thread_ts,
            channel_id=self.channel_id,
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            group=self.group,
        )

        mock_populate_cache.assert_called_once()
        call_kwargs = mock_populate_cache.call_args.kwargs
        cache_payload = call_kwargs["cache_payload"]
        assert cache_payload["automation_stopping_point"] is None

    @patch("sentry.seer.entrypoints.integrations.slack.schedule_all_thread_updates")
    def test_on_autofix_update_has_progressed_based_on_automation_stopping_point(
        self, mock_schedule_all_thread_updates
    ):
        """Test that has_progressed is set based on automation_stopping_point hierarchy."""
        from sentry.sentry_apps.metrics import SentryAppEventType

        ep = self._get_entrypoint()
        cache_payload = ep.create_autofix_cache_payload()
        # Set automation stopping point to CODE_CHANGES
        cache_payload["automation_stopping_point"] = AutofixStoppingPoint.CODE_CHANGES
        event_payload = {
            "run_id": 123,
            "group_id": self.group.id,
            "root_cause": {"description": "Test", "steps": []},
        }

        ep.on_autofix_update(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

        mock_schedule_all_thread_updates.assert_called_once()
        data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        # ROOT_CAUSE (rank 0) < CODE_CHANGES (rank 2), so has_progressed should be True
        assert data.has_progressed is True

    @patch("sentry.seer.entrypoints.integrations.slack.schedule_all_thread_updates")
    def test_on_autofix_update_not_progressed_at_stopping_point(
        self, mock_schedule_all_thread_updates
    ):
        """Test that has_progressed is False when at the automation stopping point."""
        from sentry.sentry_apps.metrics import SentryAppEventType

        ep = self._get_entrypoint()
        cache_payload = ep.create_autofix_cache_payload()
        # Set automation stopping point to ROOT_CAUSE
        cache_payload["automation_stopping_point"] = AutofixStoppingPoint.ROOT_CAUSE
        event_payload = {
            "run_id": 123,
            "group_id": self.group.id,
            "root_cause": {"description": "Test", "steps": []},
        }

        ep.on_autofix_update(
            event_type=SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED,
            event_payload=event_payload,
            cache_payload=cache_payload,
        )

        mock_schedule_all_thread_updates.assert_called_once()
        data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        # ROOT_CAUSE (rank 0) == ROOT_CAUSE (rank 0), so has_progressed should be False
        assert data.has_progressed is False

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message_handles_invalid_payload(self, mock_update_message):
        """Test that update_existing_message handles invalid request payload gracefully."""
        self.slack_request.data = {"message": None}

        data = SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=AutofixStoppingPoint.ROOT_CAUSE,
            group_link=self.group.get_absolute_url(),
            has_progressed=True,
        )
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            slack_user_id=self.slack_user_id,
        )

        mock_update_message.assert_not_called()

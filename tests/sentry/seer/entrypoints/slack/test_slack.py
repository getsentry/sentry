from datetime import UTC, datetime
from typing import Any
from unittest.mock import ANY, Mock, patch

import pytest
from slack_sdk.errors import SlackApiError
from slack_sdk.models.blocks import LinkButtonElement, SectionBlock
from slack_sdk.web import SlackResponse

from fixtures.seer.webhooks import MOCK_RUN_ID, MOCK_SEER_WEBHOOKS
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.integrations.types import EventLifecycleOutcome
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.investigations.models.orchestration import (
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationStatus,
)
from sentry.notifications.platform.service import serialize_notification_data
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import (
    SeerAgentError,
    SeerAgentResponse,
    SeerAgentWriteApproval,
    SeerAutofixUpdate,
)
from sentry.notifications.platform.tracking import NotificationLink, NotificationTrackingContext
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationSource,
)
from sentry.notifications.utils.actions import BlockKitMessageAction
from sentry.seer.agent.client_models import (
    MemoryBlock,
    Message,
    PendingUserInput,
    SeerRunState,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint, CodingAgentProviderType
from sentry.seer.entrypoints.cache import (
    SeerOperatorAutofixCache,
    SeerOperatorInvestigationCache,
)
from sentry.seer.entrypoints.operator import SeerAutofixOperator, process_autofix_updates
from sentry.seer.entrypoints.slack.cache import SlackSeerAgentMessageCache
from sentry.seer.entrypoints.slack.entrypoint import (
    EntrypointSetupError,
    SlackAgentCachePayload,
    SlackAgentEntrypoint,
    SlackAutofixCachePayload,
    SlackAutofixEntrypoint,
    SlackInvestigationCachePayload,
    SlackInvestigationEntrypoint,
    SlackThreadDetails,
    prepare_slack_thread_for_autofix_updates,
)
from sentry.seer.entrypoints.slack.messaging import (
    process_thread_update,
    schedule_all_thread_updates,
    send_thread_update,
    update_existing_message,
)
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.seer.models import SeerAutomationHandoffConfiguration, SeerProjectPreference
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.asserts import assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.locking import UnableToAcquireLock


class SlackAutofixEntrypointTest(TestCase):
    def setUp(self) -> None:
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

    def _create_update(
        self,
        current_point: AutofixStoppingPoint = AutofixStoppingPoint.ROOT_CAUSE,
    ) -> SeerAutofixUpdate:
        return SeerAutofixUpdate(
            run_id=MOCK_RUN_ID,
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            group_id=self.group.id,
            current_point=current_point,
            group_link=self.group.get_absolute_url(),
        )

    def _get_entrypoint(self) -> SlackAutofixEntrypoint:
        return SlackAutofixEntrypoint(
            slack_request=self.slack_request,
            group=self.group,
            organization_id=self.organization.id,
            action=self.action,
        )

    def test_has_access(self) -> None:
        assert SlackAutofixEntrypoint.has_access(self.organization)

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

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_handoff_error(self, mock_send_threaded_ephemeral_message):
        ep = self._get_entrypoint()
        ep.on_trigger_handoff_error(error="boom")
        mock_send_threaded_ephemeral_message.assert_called_once()

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_on_trigger_handoff_success(self, mock_update_message):
        self.slack_request.data = {
            "message": {"ts": self.thread_ts, "text": "Issue notification", "blocks": []}
        }
        ep = self._get_entrypoint()
        ep.on_trigger_handoff_success(
            run_id=MOCK_RUN_ID,
            target=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
        )
        mock_update_message.assert_called_once()
        renderable = mock_update_message.call_args.kwargs["renderable"]
        # Footer working text should mention the target.
        assert any(
            "Handing off to Cursor" in (block.text.text if getattr(block, "text", None) else "")
            for block in renderable["blocks"]
        )

    @patch("sentry.seer.autofix.utils.read_preference_from_sentry_db")
    def test_create_autofix_cache_payload(self, mock_read_pref) -> None:
        mock_read_pref.return_value = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            repositories=[],
        )
        ep = self._get_entrypoint()
        cache_payload = ep.create_autofix_cache_payload()
        SlackAutofixCachePayload(**cache_payload)
        assert cache_payload["group_link"] == SlackAutofixEntrypoint.get_group_link(self.group)
        assert cache_payload["organization_id"] == self.organization.id
        assert cache_payload["integration_id"] == self.integration.id
        assert cache_payload["project_id"] == self.group.project.id
        assert cache_payload["group_id"] == self.group.id
        assert cache_payload["threads"] == [self.thread]
        assert cache_payload["handoff_target"] is None

    @patch("sentry.seer.autofix.utils.read_preference_from_sentry_db")
    def test_create_autofix_cache_payload_captures_handoff_target(self, mock_read_pref) -> None:
        mock_read_pref.return_value = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.group.project.id,
            repositories=[],
            automation_handoff=SeerAutomationHandoffConfiguration(
                handoff_point="root_cause",
                target=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
                integration_id=789,
            ),
        )
        ep = self._get_entrypoint()
        cache_payload = ep.create_autofix_cache_payload()
        assert cache_payload["handoff_target"] == CodingAgentProviderType.CURSOR_BACKGROUND_AGENT

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
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

    @patch.object(SeerAutofixOperator, "has_access", return_value=True)
    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.send_threaded_message",
        return_value={"ok": True, "ts": "1234567890.000100"},
    )
    def test_pr_created_and_ready_for_review_post_one_slack_message(
        self, mock_send_threaded_message, _mock_has_access
    ):
        SeerOperatorAutofixCache.populate_post_autofix_cache(
            entrypoint_key=SeerEntrypointKey.SLACK,
            run_id=MOCK_RUN_ID,
            cache_payload=self._get_entrypoint().create_autofix_cache_payload(),
        )

        # Non-draft PRs emit both signals back to back from the completion hook
        with self.tasks():
            for event_type in (
                SentryAppEventType.SEER_PR_CREATED,
                SentryAppEventType.SEER_PR_READY_FOR_REVIEW,
            ):
                process_autofix_updates(
                    event_type=event_type,
                    event_payload={**MOCK_SEER_WEBHOOKS[event_type], "group_id": self.group.id},
                    organization_id=self.organization.id,
                )

        mock_send_threaded_message.assert_called_once_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
        )
        renderable = mock_send_threaded_message.call_args.kwargs["renderable"]
        assert "https://github.com/owner/repo/pull/123" in str(renderable["blocks"])

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.send_threaded_message",
        return_value={"ok": True, "ts": "1234567890.000100"},
    )
    def test_send_thread_update(
        self, mock_send_threaded_message, mock_send_threaded_ephemeral_message
    ):
        data = self._create_update(AutofixStoppingPoint.SOLUTION)
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

    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message",
        side_effect=TimeoutError,
    )
    def test_send_thread_update_normalizes_timeout(self, _mock_send_ephemeral):
        install = self.integration.get_installation(organization_id=self.organization.id)

        with pytest.raises(IntegrationError):
            send_thread_update(
                install=install,
                thread=self.thread,
                data=self._create_update(),
                ephemeral_user_id=self.slack_user_id,
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

        data = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            has_complete_stage=False,
            slack_user_id=self.slack_user_id,
        )

        mock_update_message.assert_called_once()
        call_args = mock_update_message.call_args
        assert call_args.kwargs["channel_id"] == self.channel_id
        assert call_args.kwargs["message_ts"] == self.thread_ts
        renderable = call_args.kwargs["renderable"]
        # Original section block + actions block (with non-autofix button) + footer section
        assert len(renderable["blocks"]) == 3
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

    def test_get_autofix_lock_key(self) -> None:
        lock_key = SlackAutofixEntrypoint.get_autofix_lock_key(
            group_id=self.group.id,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
        )
        assert lock_key is not None
        assert "autofix:entrypoint:slack" in lock_key
        assert str(self.group.id) in lock_key
        assert AutofixStoppingPoint.ROOT_CAUSE.value in lock_key

    @patch("sentry.seer.entrypoints.slack.messaging.process_thread_update")
    def test_schedule_all_thread_updates(self, mock_process_thread_update):
        threads = [
            SlackThreadDetails(thread_ts="1234567890.123456", channel_id="C1234567890"),
            SlackThreadDetails(thread_ts="1234567890.654321", channel_id="C0987654321"),
        ]
        data = self._create_update(AutofixStoppingPoint.SOLUTION)

        schedule_all_thread_updates(
            threads=threads,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            data=data,
        )

        assert mock_process_thread_update.apply_async.call_count == len(threads)

    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.send_threaded_message",
        return_value={"ok": True, "ts": "1234567890.000100"},
    )
    def test_process_thread_update(self, mock_send_threaded_message):
        data = self._create_update(AutofixStoppingPoint.SOLUTION)
        serialized_data = serialize_notification_data(data)

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
        "sentry.seer.entrypoints.slack.entrypoint.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.slack.entrypoint.SeerOperatorAutofixCache.get")
    def test_prepare_slack_thread_for_autofix_updates_empty_cache(
        self, mock_cache_get, mock_populate_cache
    ):
        mock_cache_get.return_value = None
        mock_populate_cache.return_value = {"key": "test_key", "source": "group_id"}

        prepare_slack_thread_for_autofix_updates(
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
        "sentry.seer.entrypoints.slack.entrypoint.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.slack.entrypoint.SeerOperatorAutofixCache.get")
    def test_prepare_slack_thread_for_autofix_updates_merges_threads(
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

        prepare_slack_thread_for_autofix_updates(
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
        "sentry.seer.entrypoints.slack.entrypoint.SeerOperatorAutofixCache.populate_pre_autofix_cache",
        return_value={"key": "just_returning_for_logging", "source": "group_id"},
    )
    @patch("sentry.seer.entrypoints.slack.entrypoint.SeerOperatorAutofixCache.get")
    def test_prepare_slack_thread_for_autofix_updates_no_duplicate_threads(
        self, mock_cache_get, mock_populate_cache
    ):
        existing_thread = SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)
        mock_cache_get.return_value = {
            "payload": {"threads": [existing_thread]},
            "source": "group_id",
            "key": "test_key",
        }

        prepare_slack_thread_for_autofix_updates(
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

        data = self._create_update(AutofixStoppingPoint.SOLUTION)
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            has_complete_stage=False,
            slack_user_id=self.slack_user_id,
        )
        mock_update_message.assert_called_once()
        renderable: SlackRenderable = mock_update_message.call_args.kwargs["renderable"]
        # Original section block + footer section (actions block removed entirely)
        assert len(renderable["blocks"]) == 2
        assert all(block.type != "actions" for block in renderable["blocks"])

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message_without_slack_user_id(self, mock_update_message):
        self.slack_request.data = {
            "message": {"ts": self.thread_ts, "text": "Issue notification", "blocks": []}
        }

        data = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            has_complete_stage=False,
            slack_user_id=None,
        )

        mock_update_message.assert_called_once()

    @override_options({"notifications.tracking.sources": [NotificationSource.SEER_AUTOFIX_UPDATE]})
    @patch("sentry.seer.entrypoints.slack.messaging.record_sent")
    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message_records_sent(self, mock_update_message, mock_record_sent):
        self.slack_request.data = {
            "message": {"ts": self.thread_ts, "text": "Issue notification", "blocks": []}
        }

        data = self._create_update(AutofixStoppingPoint.SOLUTION)
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            has_complete_stage=False,
            slack_user_id=None,
        )

        renderable: SlackRenderable = mock_update_message.call_args.kwargs["renderable"]
        footer = renderable["blocks"][-1]
        assert isinstance(footer, SectionBlock)
        assert isinstance(footer.accessory, LinkButtonElement)
        assert f"notification_uuid={data.notification_uuid}" in (footer.accessory.url or "")
        mock_record_sent.assert_called_once_with(
            NotificationTrackingContext(
                source=NotificationSource.SEER_AUTOFIX_UPDATE,
                provider=NotificationProviderKey.SLACK,
                category=NotificationCategory.SEER,
                notification_uuid=data.notification_uuid,
                organization_id=self.organization.id,
            ),
            links={NotificationLink.ISSUE},
        )

    @patch("sentry.seer.entrypoints.slack.messaging.record_sent")
    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.update_message",
        side_effect=IntegrationError("update failed"),
    )
    def test_update_existing_message_failure_does_not_record_sent(
        self, mock_update_message, mock_record_sent
    ):
        self.slack_request.data = {
            "message": {"ts": self.thread_ts, "text": "Issue notification", "blocks": []}
        }

        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=self._create_update(AutofixStoppingPoint.SOLUTION),
            has_complete_stage=False,
            slack_user_id=None,
        )

        mock_update_message.assert_called_once()
        mock_record_sent.assert_not_called()

    def _assert_stopping_point_from_action(self, value, expected):
        action = BlockKitMessageAction(
            name=SlackAction.SEER_AUTOFIX_START.value,
            label="Fix with Seer",
            action_id=SlackAction.SEER_AUTOFIX_START.value,
            value=value,
        )
        result = SlackAutofixEntrypoint.get_autofix_stopping_point_from_action(
            action=action, group_id=self.group.id
        )
        assert result == expected

    def test_get_autofix_stopping_point_from_action(self) -> None:
        # Empty, None, and invalid values default to ROOT_CAUSE
        self._assert_stopping_point_from_action("", AutofixStoppingPoint.ROOT_CAUSE)
        self._assert_stopping_point_from_action(None, AutofixStoppingPoint.ROOT_CAUSE)
        self._assert_stopping_point_from_action("invalid", AutofixStoppingPoint.ROOT_CAUSE)
        # Valid values return correct stopping point
        self._assert_stopping_point_from_action(
            AutofixStoppingPoint.SOLUTION.value, AutofixStoppingPoint.SOLUTION
        )

    def test_get_group_link_includes_seer_drawer(self) -> None:
        link = SlackAutofixEntrypoint.get_group_link(self.group)
        assert "seerDrawer=true" in link

    @patch("sentry.integrations.slack.integration.SlackIntegration.update_message")
    def test_update_existing_message_handles_invalid_payload(self, mock_update_message):
        self.slack_request.data = {"message": None}

        data = self._create_update(AutofixStoppingPoint.ROOT_CAUSE)
        install = self.integration.get_installation(organization_id=self.organization.id)
        update_existing_message(
            request=self.slack_request,
            install=install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            has_complete_stage=False,
            slack_user_id=self.slack_user_id,
        )

        mock_update_message.assert_not_called()


def _agent_state(
    summary: str | None, pending_user_input: PendingUserInput | None = None
) -> SeerRunState:
    """A finished run with one turn, which ends with `summary` if given."""
    blocks = [
        MemoryBlock(
            id="b1", message=Message(role="user", content="hi"), timestamp="2024-01-01T00:00:00Z"
        )
    ]
    if summary:
        blocks.append(
            MemoryBlock(
                id="b2",
                message=Message(role="assistant", content=summary),
                timestamp="2024-01-01T00:00:01Z",
            )
        )
    return SeerRunState(
        run_id=12345,
        blocks=blocks,
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
        pending_user_input=pending_user_input,
    )


class SlackAgentEntrypointTest(TestCase):
    def setUp(self) -> None:
        self.slack_user_id = "UXXXXXXXXX2"
        self.channel_id = "CXXXXXXXXX2"
        self.thread_ts = "1712345678.222222"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="TXXXXXXXXX2",
            provider="slack",
        )

    def _get_entrypoint(self, thread_ts: str | None = None) -> SlackAgentEntrypoint:
        return SlackAgentEntrypoint(
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            channel_id=self.channel_id,
            thread_ts=thread_ts if thread_ts is not None else self.thread_ts,
            slack_user_id=self.slack_user_id,
        )

    def test_init_success(self) -> None:
        ep = self._get_entrypoint()
        assert ep.channel_id == self.channel_id
        assert ep.thread_ts == self.thread_ts
        assert ep.organization_id == self.organization.id
        assert ep.slack_user_id == self.slack_user_id
        assert ep.install.model.id == self.integration.id
        assert ep.thread == SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)

    def test_init_raises_if_integration_not_found(self) -> None:
        with pytest.raises(EntrypointSetupError):
            SlackAgentEntrypoint(
                integration_id=99999,
                organization_id=self.organization.id,
                channel_id=self.channel_id,
                thread_ts=self.thread_ts,
                slack_user_id=self.slack_user_id,
            )

    @patch(
        "sentry.integrations.services.integration.service.integration_service.get_organization_integrations",
        return_value=[],
    )
    def test_init_raises_if_no_org_integration(self, mock_get_ois):
        with pytest.raises(EntrypointSetupError):
            SlackAgentEntrypoint(
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                channel_id=self.channel_id,
                thread_ts=self.thread_ts,
                slack_user_id=self.slack_user_id,
            )

    def test_has_access(self) -> None:
        assert SlackAgentEntrypoint.has_access(self.organization)

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    def test_on_trigger_agent_error(self, mock_send_ephemeral):
        ep = self._get_entrypoint()
        ep.on_trigger_agent_error(error="Test error")

        mock_send_ephemeral.assert_called_once_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_user_id,
        )

    def test_on_trigger_agent_success_is_noop(self) -> None:
        ep = self._get_entrypoint()
        ep.on_trigger_agent_success(run_id=12345)

    def test_create_agent_cache_payload(self) -> None:
        ep = self._get_entrypoint()
        payload = ep.create_agent_cache_payload()
        SlackAgentCachePayload(**payload)  # validates TypedDict structure
        assert payload["organization_id"] == self.organization.id
        assert payload["integration_id"] == self.integration.id
        assert payload["thread"]["thread_ts"] == self.thread_ts
        assert payload["thread"]["channel_id"] == self.channel_id
        assert payload["slack_user_id"] == self.slack_user_id

    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message",
        return_value={"ok": True, "message_ts": "1234567890.000100"},
    )
    def test_send_ephemeral_write_approval_caches_input_id(self, mock_send_ephemeral):
        ep = self._get_entrypoint()
        data = SeerAgentWriteApproval(
            run_id=12345,
            organization_id=self.organization.id,
            input_id="approval-1",
            scopes=["org:write"],
        )

        send_thread_update(
            install=ep.install,
            thread=ep.thread,
            data=data,
            ephemeral_user_id=self.slack_user_id,
        )

        mock_send_ephemeral.assert_called_once_with(
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            renderable=ANY,
            slack_user_id=self.slack_user_id,
        )
        assert SlackSeerAgentMessageCache.get(
            integration_id=self.integration.id,
            channel_id=self.channel_id,
            message_ts="1234567890.000100",
        ) == {
            "thread_ts": self.thread_ts,
            "run_id": 12345,
            "input_id": "approval-1",
        }

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.has_history_scope",
        return_value=True,
    )
    def test_on_agent_update(self, mock_has_history_scope, mock_schedule_all_thread_updates):
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()
        run_id = 12345

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=run_id,
            state=_agent_state("Test summary"),
        )

        mock_schedule_all_thread_updates.assert_called_once_with(
            threads=[cache_payload["thread"]],
            integration_id=self.integration.id,
            organization_id=self.organization.id,
            data=ANY,
        )
        call_data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert call_data.run_id == run_id
        assert call_data.organization_id == self.organization.id
        assert call_data.summary == "Test summary"

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    def test_on_agent_update_with_no_summary(self, mock_schedule_all_thread_updates):
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12345,
            state=_agent_state(None),
        )

        mock_schedule_all_thread_updates.assert_called_once()
        call_data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert isinstance(call_data, SeerAgentError)
        assert call_data.error_message == "Seer was unable to generate a response."

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    def test_on_agent_update_does_not_reuse_the_previous_turns_answer(
        self, mock_schedule_all_thread_updates
    ):
        cache_payload = self._get_entrypoint().create_agent_cache_payload()
        state = _agent_state("First answer")
        state.blocks.append(
            MemoryBlock(
                id="b3",
                message=Message(role="user", content="follow-up"),
                timestamp="2024-01-01T00:00:02Z",
            )
        )

        SlackAgentEntrypoint.on_agent_update(cache_payload=cache_payload, run_id=12345, state=state)

        call_data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert isinstance(call_data, SeerAgentError)

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    @patch("sentry.seer.entrypoints.slack.entrypoint._send_agent_write_approval")
    def test_on_agent_update_with_write_approval(
        self, mock_send_write_approval, mock_schedule_all_thread_updates
    ):
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12345,
            state=_agent_state(
                None,
                pending_user_input=PendingUserInput(
                    id="approval-1",
                    input_type="agent_write_approval",
                    data={"required_scopes": ["org:write"], "session_id": "12345"},
                ),
            ),
        )

        mock_send_write_approval.assert_called_once()
        call_data = mock_send_write_approval.call_args.kwargs["data"]
        assert isinstance(call_data, SeerAgentWriteApproval)
        assert call_data.input_id == "approval-1"
        assert call_data.scopes == ["org:write"]
        assert mock_send_write_approval.call_args.kwargs["slack_user_id"] == self.slack_user_id
        response_data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert isinstance(response_data, SeerAgentResponse)
        assert response_data.summary == (
            f"<@{self.slack_user_id}> I need your approval to make changes in Sentry. "
            "I sent you a message."
        )

    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_ephemeral_message")
    @patch("sentry.integrations.slack.integration.SlackIntegration.send_threaded_message")
    def test_on_agent_update_supports_cached_payload_without_slack_user(
        self, mock_send_message, mock_send_ephemeral
    ):
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()
        cache_payload.pop("slack_user_id")

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12345,
            state=_agent_state(
                None,
                pending_user_input=PendingUserInput(
                    id="approval-1",
                    input_type="agent_write_approval",
                    data={"required_scopes": ["org:write"], "session_id": "12345"},
                ),
            ),
        )

        mock_send_message.assert_not_called()
        mock_send_ephemeral.assert_not_called()

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    def test_on_agent_update_rejects_invalid_write_approval(self, mock_schedule_all_thread_updates):
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12345,
            state=_agent_state(
                "Prior summary",
                pending_user_input=PendingUserInput(
                    id="approval-1",
                    input_type="agent_write_approval",
                    data={"required_scopes": ["org:write"]},
                ),
            ),
        )

        call_data = mock_schedule_all_thread_updates.call_args.kwargs["data"]
        assert isinstance(call_data, SeerAgentError)

    def test_on_agent_update_skips_clear_when_integration_not_found(self) -> None:
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()

        with (
            patch(
                "sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates"
            ) as mock_schedule,
            patch(
                "sentry.integrations.services.integration.service.integration_service.get_integration",
                return_value=None,
            ),
        ):
            SlackAgentEntrypoint.on_agent_update(
                cache_payload=cache_payload,
                run_id=12345,
                state=_agent_state(None),
            )

        # Still schedules the thread update even without a fresh integration
        mock_schedule.assert_called_once()

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.has_history_scope",
        return_value=False,
    )
    def test_on_agent_update_sets_missing_scope_url(self, mock_has_history_scope, mock_schedule):
        """When history scope is missing, on_agent_update sets missing_scope_settings_url."""
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12345,
            state=_agent_state("Test summary"),
        )

        call_data = mock_schedule.call_args.kwargs["data"]
        assert isinstance(call_data, SeerAgentResponse)
        assert call_data.missing_scope_settings_url is not None
        assert "/integrations/slack/" in call_data.missing_scope_settings_url

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.has_history_scope",
        return_value=True,
    )
    def test_on_agent_update_no_missing_scope_url_when_has_scope(
        self, mock_has_history_scope, mock_schedule
    ):
        """When history scope is present, missing_scope_settings_url should be None."""
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12345,
            state=_agent_state("Test summary"),
        )

        call_data = mock_schedule.call_args.kwargs["data"]
        assert isinstance(call_data, SeerAgentResponse)
        assert call_data.missing_scope_settings_url is None

    @patch("sentry.seer.entrypoints.slack.entrypoint.schedule_all_thread_updates")
    @patch(
        "sentry.integrations.slack.integration.SlackIntegration.has_history_scope",
        return_value=False,
    )
    def test_on_agent_update_missing_scope_url_cached_per_thread(
        self, mock_has_history_scope, mock_schedule
    ):
        """Second call for the same thread should not set the URL (cached)."""
        ep = self._get_entrypoint()
        cache_payload = ep.create_agent_cache_payload()

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12345,
            state=_agent_state("First response"),
        )
        first_data = mock_schedule.call_args.kwargs["data"]
        assert first_data.missing_scope_settings_url is not None

        mock_schedule.reset_mock()

        SlackAgentEntrypoint.on_agent_update(
            cache_payload=cache_payload,
            run_id=12346,
            state=_agent_state("Second response"),
        )
        second_data = mock_schedule.call_args.kwargs["data"]
        assert second_data.missing_scope_settings_url is None


def _slack_response(data: dict[str, Any]) -> SlackResponse:
    return SlackResponse(
        client=None,
        http_verb="POST",
        api_url="https://slack.com/api/",
        req_args={},
        data=data,
        headers={},
        status_code=200,
    )


def _hypothesis(**overrides: Any) -> dict[str, Any]:
    return {
        "id": "h1",
        "order": 0,
        "generation": 1,
        "statement": "Database or cache degradation delayed the response",
        "rationale": "Server response time rose with the breach.",
        "effectiveStatus": "investigating",
        "agentVerdict": None,
        "verificationSteps": [
            {"id": "s1", "order": 0, "title": "Read the error logs", "status": "completed"},
            {"id": "s2", "order": 1, "title": "Compare cache behavior", "status": "running"},
        ],
        **overrides,
    }


class SlackInvestigationEntrypointTest(TestCase):
    def setUp(self) -> None:
        self.slack_user_id = "UXXXXXXXXX3"
        self.channel_id = "CXXXXXXXXX3"
        self.message_ts = "1712345678.333333"
        self.status_ts = "1712345678.444444"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="TXXXXXXXXX3",
            provider="slack",
            metadata={"access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        self.investigation = self.create_investigation(
            organization=self.organization,
            source={
                "type": "metric_open_period",
                "snapshot": {
                    "monitor": {
                        "name": "FCP on organization login pages",
                        "query": "transaction:/auth/login/[org]/",
                    },
                    "analysisWindow": {
                        "breachStart": "2024-08-27T09:00:00+00:00",
                        "end": "2024-08-27T11:00:00+00:00",
                    },
                },
            },
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            phase=InvestigationOrchestrationPhase.INVESTIGATING,
            status=InvestigationOrchestrationStatus.PROCESSING,
        )
        self.mock_update = self.enterContext(
            patch(
                "slack_sdk.web.client.WebClient.chat_update",
                return_value=_slack_response({"ok": True}),
            )
        )
        self.mock_post_message = self.enterContext(
            patch(
                "slack_sdk.web.client.WebClient.chat_postMessage",
                return_value=_slack_response({"ok": True, "ts": self.status_ts}),
            )
        )

    def _get_entrypoint(self) -> SlackInvestigationEntrypoint:
        slack_request = Mock()
        slack_request.integration = self.integration
        slack_request.data = {"message": {"ts": self.message_ts}}
        return SlackInvestigationEntrypoint(
            slack_request=slack_request,
            organization=self.organization,
            channel_id=self.channel_id,
            message_ts=self.message_ts,
            slack_user_id=self.slack_user_id,
        )

    def _set_cache(
        self, *, status_message_ts: str | None = "1712345678.444444"
    ) -> SlackInvestigationCachePayload:
        cache_payload = SlackInvestigationCachePayload(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            channel_id=self.channel_id,
            thread_ts=self.message_ts,
            alert_message_ts=self.message_ts,
            status_message_ts=status_message_ts,
            slack_user_id=self.slack_user_id,
            last_sent_state=None,
            final_sent=False,
        )
        SeerOperatorInvestigationCache.set(
            entrypoint_key="slack",
            investigation_id=self.investigation.id,
            cache_payload=cache_payload,
        )
        return cache_payload

    def _get_cache(self) -> SlackInvestigationCachePayload | None:
        return SeerOperatorInvestigationCache[SlackInvestigationCachePayload].get(
            entrypoint_key="slack", investigation_id=self.investigation.id
        )

    def _update(
        self,
        hypotheses: list[dict[str, Any]],
        updated_at: datetime = datetime(2024, 8, 27, 11, 0, tzinfo=UTC),
    ) -> None:
        self.orchestration_run.projection = {"hypotheses": hypotheses}
        InvestigationOrchestrationRun.objects.filter(id=self.orchestration_run.id).update(
            projection=self.orchestration_run.projection, date_updated=updated_at
        )
        cache_payload = self._get_cache()
        assert cache_payload is not None
        SlackInvestigationEntrypoint.on_investigation_update(
            cache_payload=cache_payload, run=self.orchestration_run
        )

    def _updated_blocks(self) -> list[Any]:
        return self.mock_update.call_args.kwargs["blocks"]

    def _quotes(self, blocks: list[Any]) -> list[list[dict[str, Any]]]:
        return [
            block.to_dict()["elements"][0]["elements"]
            for block in blocks
            if block.type == "rich_text"
        ]

    def _task_card(self, blocks: list[Any]) -> dict[str, Any]:
        (task_card,) = [block.to_dict() for block in blocks if block.type == "task_card"]
        return {
            "title": task_card["title"],
            "status": task_card["status"],
            "detail": task_card["details"]["elements"][0]["elements"][0]["text"],
        }

    def _set_status(self, status: InvestigationOrchestrationStatus) -> None:
        InvestigationOrchestrationRun.objects.filter(id=self.orchestration_run.id).update(
            status=status
        )

    def _report_cell(self, content: str, **kwargs: Any) -> None:
        kwargs.setdefault("report_revision", 0)
        self.create_investigation_block(investigation=self.investigation, content=content, **kwargs)

    def _conclusion_sections(self) -> list[str]:
        (call,) = [
            call
            for call in self.mock_post_message.call_args_list
            if call.kwargs["text"] == "Seer finished the investigation"
        ]
        assert call.kwargs["thread_ts"] == self.message_ts
        *sections, _divider, actions = call.kwargs["blocks"]
        assert actions.elements[0].url.startswith(self.investigation.get_absolute_url())
        return [section.text for section in sections]

    def test_trigger_success_leaves_status_message_to_updates(self) -> None:
        entrypoint = self._get_entrypoint()

        entrypoint.on_trigger_investigation_success(investigation=self.investigation)

        (started_call,) = self.mock_post_message.call_args_list
        assert started_call.kwargs["text"] != "Investigating FCP on organization login pages"
        cache_payload = entrypoint.create_investigation_cache_payload()
        assert cache_payload["status_message_ts"] is None
        assert cache_payload["last_sent_state"] is None

    def test_update_with_hypotheses_updates_status_message(self) -> None:
        self._set_cache()

        self._update([_hypothesis()])

        self.mock_post_message.assert_not_called()
        update_kwargs = self.mock_update.call_args.kwargs
        assert update_kwargs["channel"] == self.channel_id
        assert update_kwargs["ts"] == self.status_ts
        assert update_kwargs["text"] == "Investigating FCP on organization login pages"
        blocks = update_kwargs["blocks"]
        (quote,) = self._quotes(blocks)
        assert [part["text"] for part in quote] == [
            "1. Database or cache degradation delayed the response",
            "\n● Verifying",
            "\nCompare cache behavior",
        ]
        assert self._task_card(blocks) == {
            "title": "Verifying hypotheses",
            "status": "in_progress",
            "detail": "Checking the remaining explanations against related telemetry.",
        }
        cache_payload = self._get_cache()
        assert cache_payload is not None
        assert cache_payload["status_message_ts"] == self.status_ts
        assert cache_payload["last_sent_state"] is not None

    @override_options(
        {"notifications.tracking.sources": [NotificationSource.SEER_INVESTIGATION_STATUS]}
    )
    @patch("sentry.seer.entrypoints.slack.entrypoint.record_sent")
    def test_status_message_links_are_tracked(self, mock_record_sent: Mock) -> None:
        self._set_cache(status_message_ts=None)
        self._update([])
        self._update([_hypothesis()])

        (status_call,) = self.mock_post_message.call_args_list
        referrer = (
            f"{self.investigation.get_absolute_url()}?referrer=seer-investigation-status-slack"
        )
        assert status_call.kwargs["blocks"][-1].elements[0].url.startswith(referrer)
        assert self._updated_blocks()[-1].elements[0].url.startswith(referrer)
        sent_call, updated_call = mock_record_sent.call_args_list
        assert sent_call.args[0].source == NotificationSource.SEER_INVESTIGATION_STATUS
        assert (
            sent_call.kwargs["links"]
            == updated_call.kwargs["links"]
            == {NotificationLink.INVESTIGATION}
        )

    def test_identical_update_makes_no_slack_call(self) -> None:
        self._set_cache()
        self._update([_hypothesis()])
        self.mock_update.reset_mock()

        self._update([_hypothesis()])

        self.mock_update.assert_not_called()
        self.mock_post_message.assert_not_called()

    def test_task_card_forms_hypotheses_before_checks_are_planned(self) -> None:
        self._set_cache()

        self._update([_hypothesis(verificationSteps=[])])

        assert self._task_card(self._updated_blocks()) == {
            "title": "Forming hypotheses",
            "status": "in_progress",
            "detail": "Checking the available telemetry for plausible explanations of the alert.",
        }

    def test_task_card_follows_run_phase(self) -> None:
        cases = {
            InvestigationOrchestrationPhase.BROAD_SCAN: {
                "title": "Gathering context",
                "status": "in_progress",
                "detail": "Comparing the alert with related telemetry.",
            },
            InvestigationOrchestrationPhase.JUDGING: {
                "title": "Reviewing findings",
                "status": "in_progress",
                "detail": "Reviewing the evidence behind each verdict and identifying what remains uncertain.",
            },
            InvestigationOrchestrationPhase.REPORTING: {
                "title": "Preparing conclusion",
                "status": "in_progress",
                "detail": "Bringing the evidence, remaining uncertainty, and suggested next steps into a conclusion.",
            },
            InvestigationOrchestrationPhase.COMPLETED: {
                "title": "Investigation complete",
                "status": "complete",
                "detail": "Seer finished checking every hypothesis.",
            },
        }
        for phase, task_card in cases.items():
            InvestigationOrchestrationRun.objects.filter(id=self.orchestration_run.id).update(
                phase=phase
            )
            self._set_cache()

            self._update([_hypothesis()])

            assert self._task_card(self._updated_blocks()) == task_card, phase

    def test_failed_or_cancelled_run_shows_interrupted(self) -> None:
        for status in (
            InvestigationOrchestrationStatus.FAILED,
            InvestigationOrchestrationStatus.CANCELLED,
        ):
            self._set_cache()
            InvestigationOrchestrationRun.objects.filter(id=self.orchestration_run.id).update(
                status=status
            )

            self._update(
                [
                    _hypothesis(id="h1", order=0),
                    _hypothesis(
                        id="h2",
                        order=1,
                        effectiveStatus="supported",
                        agentVerdict={"rationale": "Cache misses exposed a slow lookup."},
                    ),
                ]
            )

            quotes = self._quotes(self._updated_blocks())
            assert [(quote[1]["text"], quote[2]["text"]) for quote in quotes] == [
                (
                    "\n● Not completed",
                    "\nVerification stopped before this explanation could be assessed.",
                ),
                ("\n● Supported", "\nCache misses exposed a slow lookup."),
            ], status
            assert self._task_card(self._updated_blocks()) == {
                "title": "Investigation interrupted",
                "status": "error",
                "detail": "Seer couldn't finish the investigation. "
                "The available work is preserved; no conclusion was produced.",
            }, status

    def test_run_awaiting_input_shows_waiting_card(self) -> None:
        self._set_cache()
        InvestigationOrchestrationRun.objects.filter(id=self.orchestration_run.id).update(
            phase=InvestigationOrchestrationPhase.INVESTIGATING,
            status=InvestigationOrchestrationStatus.AWAITING_INPUT,
        )

        self._update([_hypothesis()])

        assert self._task_card(self._updated_blocks()) == {
            "title": "Waiting for input",
            "status": "error",
            "detail": "Seer is paused until someone responds. Open the investigation to continue.",
        }

    def test_missing_status_message_ts_posts_new_message(self) -> None:
        self._set_cache(status_message_ts=None)

        self._update([_hypothesis()])

        self.mock_update.assert_not_called()
        post_kwargs = self.mock_post_message.call_args.kwargs
        assert post_kwargs["channel"] == self.channel_id
        assert post_kwargs["thread_ts"] == self.message_ts
        cache_payload = self._get_cache()
        assert cache_payload is not None
        assert cache_payload["status_message_ts"] == self.status_ts

    @patch("sentry.seer.entrypoints.slack.entrypoint.record_sent")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_integration_error_on_update_is_swallowed(
        self, mock_record: Mock, mock_record_sent: Mock
    ) -> None:
        cache_payload = self._set_cache()
        self.mock_update.side_effect = SlackApiError(
            "error", _slack_response({"ok": False, "error": "message_not_found"})
        )

        self._update([_hypothesis()])

        assert self._get_cache() == cache_payload
        assert_halt_metric(mock_record, IntegrationError())
        mock_record_sent.assert_not_called()

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_lock_failure_raises_for_task_retry(self, mock_record: Mock) -> None:
        self._set_cache()
        lock = Mock()
        lock.blocking_acquire.side_effect = UnableToAcquireLock("locked")

        with (
            patch("sentry.seer.entrypoints.slack.entrypoint.locks.get", return_value=lock),
            pytest.raises(UnableToAcquireLock),
        ):
            self._update([_hypothesis()])

        self.mock_update.assert_not_called()
        self.mock_post_message.assert_not_called()
        assert_halt_metric(mock_record, UnableToAcquireLock())

    def test_stale_cache_payload_argument_is_ignored(self) -> None:
        stale_payload = self._set_cache()
        self._update([_hypothesis()])
        self.mock_update.reset_mock()

        SlackInvestigationEntrypoint.on_investigation_update(
            cache_payload=stale_payload, run=self.orchestration_run
        )

        self.mock_update.assert_not_called()
        self.mock_post_message.assert_not_called()

    def test_stale_run_argument_uses_latest_run(self) -> None:
        self._set_cache()
        stale_run = InvestigationOrchestrationRun.objects.get(id=self.orchestration_run.id)
        self.orchestration_run.projection = {"hypotheses": [_hypothesis(statement="Latest")]}
        self.orchestration_run.save(update_fields=["projection"])
        cache_payload = self._get_cache()
        assert cache_payload is not None

        SlackInvestigationEntrypoint.on_investigation_update(
            cache_payload=cache_payload, run=stale_run
        )

        (quote,) = self._quotes(self._updated_blocks())
        assert quote[0]["text"] == "1. Latest"

    def test_completed_run_posts_conclusion_once(self) -> None:
        self._set_cache()
        self._report_cell("## Summary\n\nA release added a slow font.", position=0)
        self._report_cell("## Next steps\n\nPreload the font.", position=1)
        self._set_status(InvestigationOrchestrationStatus.COMPLETED)

        self._update([_hypothesis()])
        self._update([_hypothesis()])

        self.mock_update.assert_called_once()
        assert self._conclusion_sections() == [
            "## Summary\n\nA release added a slow font.",
            "## Next steps\n\nPreload the font.",
        ]
        cache_payload = self._get_cache()
        assert cache_payload is not None
        assert cache_payload["final_sent"] is True

    def test_conclusion_posts_when_status_is_unchanged(self) -> None:
        self._set_cache()
        self._report_cell("The release added a slow font.")
        self._update([_hypothesis()])
        self.mock_update.reset_mock()
        self._set_status(InvestigationOrchestrationStatus.COMPLETED)

        self._update([_hypothesis()])

        self.mock_update.assert_not_called()
        assert self._conclusion_sections() == ["The release added a slow font."]

    def test_failed_or_cancelled_run_posts_no_conclusion(self) -> None:
        self._report_cell("The release added a slow font.")
        for status in (
            InvestigationOrchestrationStatus.FAILED,
            InvestigationOrchestrationStatus.CANCELLED,
        ):
            self._set_cache()
            self._set_status(status)

            self._update([_hypothesis()])

            self.mock_post_message.assert_not_called()

    def test_conclusion_skips_query_deleted_empty_and_manual_cells(self) -> None:
        self._set_cache()
        self._report_cell("Second", position=2)
        self._report_cell("First", position=0)
        self._report_cell("Query", position=1, kind="query")
        self._report_cell("Deleted", position=3, deleted_at=datetime(2024, 8, 27, tzinfo=UTC))
        self._report_cell("  \n", position=4)
        self._report_cell("Manual", position=5, report_revision=None)
        self._set_status(InvestigationOrchestrationStatus.COMPLETED)

        self._update([_hypothesis()])

        assert self._conclusion_sections() == ["First", "Second"]

    def test_conclusion_strips_embed_tags(self) -> None:
        self._set_cache()
        self._report_cell(
            "Errors are a known `KeyError` (PYTHON-FLASK-6).\n\n"
            '{% issue %}{"id": "PYTHON-FLASK-6 (id 5)"}{% /issue %}\n\n'
            '## Why\nIt started at {% timestamp %}{"value": "now"}{% /timestamp %}.\n'
            '{% chart %}\n{"title": "Errors"}\n{% /chart %}\n'
            'See {% docs href="https://docs.sentry.io" title="Docs" /%}.'
        )
        self._set_status(InvestigationOrchestrationStatus.COMPLETED)

        self._update([_hypothesis()])

        assert self._conclusion_sections() == [
            "Errors are a known `KeyError` (PYTHON-FLASK-6).\n\n## Why\nIt started at .\nSee ."
        ]

    def test_no_text_cells_marks_final_sent(self) -> None:
        self._set_cache()
        self._report_cell("", kind="query")
        self._set_status(InvestigationOrchestrationStatus.COMPLETED)

        self._update([_hypothesis()])

        self.mock_post_message.assert_not_called()
        cache_payload = self._get_cache()
        assert cache_payload is not None
        assert cache_payload["final_sent"] is True

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_failed_conclusion_post_leaves_final_sent_unset(self, mock_record: Mock) -> None:
        self._report_cell("The release added a slow font.")
        self._set_status(InvestigationOrchestrationStatus.COMPLETED)
        for error, halt_count in (("ratelimited", 2), ("invalid_blocks", 1)):
            self._set_cache()
            mock_record.reset_mock()
            self.mock_post_message.side_effect = SlackApiError(
                "error", _slack_response({"ok": False, "error": error})
            )

            self._update([_hypothesis()])

            cache_payload = self._get_cache()
            assert cache_payload is not None
            assert cache_payload["final_sent"] is False, error
            assert cache_payload["last_sent_state"] is not None, error
            halts = [
                call
                for call in mock_record.mock_calls
                if call.args[0] == EventLifecycleOutcome.HALTED
            ]
            assert len(halts) == halt_count, error

    def test_conclusion_is_cut_at_a_paragraph(self) -> None:
        self._set_cache()
        self._report_cell("a" * 6000, position=0)
        self._report_cell("b" * 4000 + "\n\n" + "c" * 4000, position=1)
        self._report_cell("d", position=2)
        self._set_status(InvestigationOrchestrationStatus.COMPLETED)

        self._update([_hypothesis()])

        assert self._conclusion_sections() == [
            "a" * 6000,
            "b" * 4000,
            "_The rest of the report is in the full investigation._",
        ]

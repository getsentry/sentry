from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict
from typing import Any
from unittest import mock

import orjson
import pytest

from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity
from sentry.notifications.additional_attachment_manager import manager as attachment_manager
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import (
    execute_via_group_type_registry,
    execute_via_issue_alert_handler,
    execute_via_metric_alert_handler,
    metric_alert_notification_data_factory,
)
from sentry.notifications.platform.shadow.runner import ShadowOutcome
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)
from tests.sentry.notifications.platform.shadow.test_runner import (
    RUNNER_PATH,
    SAMPLE_ALL,
    ShadowObservation,
    observe_shadow,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]

NOTIFICATION_UUID = "7f7b1a5e-2c1d-4a53-9a57-0b3bde3b1c11"
SLACK_ISSUE_CLIENT = "sentry.integrations.slack.actions.notification.SlackSdkClient"
DISCORD_ISSUE_CLIENT = "sentry.integrations.discord.actions.issue_alert.notification.DiscordClient"
MSTEAMS_ISSUE_CLIENT = "sentry.integrations.msteams.actions.notification.MsTeamsClient"
SLACK_METRIC_CLIENT = "sentry.integrations.slack.utils.notifications.SlackSdkClient"
DISCORD_METRIC_CLIENT = "sentry.integrations.discord.actions.metric_alert.DiscordClient"
MSTEAMS_METRIC_SEND = (
    "sentry.integrations.msteams.utils.integration_service.send_msteams_incident_alert_notification"
)
SLACK_METRIC_HANDLER = "sentry.notifications.notification_action.metric_alert_registry.handlers.slack_metric_alert_handler"

CLIENTS = {
    "issue": {
        "slack": SLACK_ISSUE_CLIENT,
        "slack_staging": SLACK_ISSUE_CLIENT,
        "discord": DISCORD_ISSUE_CLIENT,
        "msteams": MSTEAMS_ISSUE_CLIENT,
    },
    "metric-alert": {
        "slack": SLACK_METRIC_CLIENT,
        "slack_staging": SLACK_METRIC_CLIENT,
        "discord": DISCORD_METRIC_CLIENT,
        "msteams": MSTEAMS_METRIC_SEND,
    },
}


class ShadowReadTestBase(BaseWorkflowTest):
    source: str

    def create_shadow_action(
        self,
        provider: str,
        data: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Action:
        integration = self.create_integration(
            organization=self.organization,
            provider=provider,
            external_id=f"{provider}-workspace",
            name=f"{provider} workspace",
            metadata=metadata or {},
        )
        return self.create_action(
            type=provider,
            integration_id=integration.id,
            data=data or {},
            config={
                "target_identifier": "C12345",
                "target_display": "#alerts",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

    def send(
        self,
        invocation: ActionInvocation,
        entry: Callable[[ActionInvocation], None] = execute_via_group_type_registry,
    ) -> tuple[ShadowObservation, mock.MagicMock]:
        """
        Sends the alert through the workflow engine with the provider client mocked, and returns
        what the shadow reported along with the client mock.
        """
        with (
            observe_shadow() as observation,
            mock.patch(CLIENTS[self.source][invocation.action.type]) as client,
        ):
            if invocation.action.type in ("slack", "slack_staging"):
                client.return_value.chat_postMessage.return_value = {"ts": "1234.5678"}
            entry(invocation)
        return observation, client


class ShadowReadIssueAlertTest(ShadowReadTestBase):
    source = "issue"

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(SAMPLE_ALL))
        self.workflow = self.create_workflow(organization=self.organization, name="Shadow Workflow")
        self.detector = Detector.objects.filter(
            project=self.project, type=ErrorGroupType.slug
        ).first() or self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.event = self.store_event(
            data={"message": "oh no", "level": "error", "tags": {"foo": "bar"}},
            project_id=self.project.id,
        )
        assert self.event.group is not None
        self.issue_group = self.event.group

    def invocation(self, action: Action) -> ActionInvocation:
        return ActionInvocation(
            event_data=WorkflowEventData(
                event=self.event.for_group(self.issue_group), group=self.issue_group
            ),
            action=action,
            detector=self.detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=self.workflow.id,
        )

    def assert_event_link_mismatch(self, observation: ShadowObservation, path: str) -> None:
        assert observation.outcome == ShadowOutcome.MISMATCH
        log = observation.mismatch
        assert log is not None
        assert log["diff_count"] == 1
        [entry] = log["diff"]
        assert entry["path"] == path
        assert f"notification_uuid={NOTIFICATION_UUID}" in entry["legacy"]
        assert f"/events/{self.event.event_id}/" not in entry["legacy"]
        assert f"/events/{self.event.event_id}/" in entry["platform"]
        assert "notification_uuid" not in entry["platform"]

    def test_slack_differs_only_by_event_link(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "level,foo", "notes": "@on-call"})

        observation, client = self.send(self.invocation(action))

        client.return_value.chat_postMessage.assert_called_once()
        self.assert_event_link_mismatch(observation, "$.blocks[0].text.text")
        log = observation.mismatch
        assert log is not None
        assert log["provider"] == "slack"
        assert log["source"] == "issue"
        assert log["organization_id"] == self.organization.id
        assert log["action_id"] == action.id
        assert log["group_id"] == self.issue_group.id

    def test_slack_mentions_read_scope_without_nudge(self) -> None:
        action = self.create_shadow_action(
            "slack", {"tags": "", "notes": ""}, metadata={"scopes": ["app_mentions:read"]}
        )

        observation, _ = self.send(self.invocation(action))

        self.assert_event_link_mismatch(observation, "$.blocks[0].text.text")

    @with_feature("organizations:slack-reinstall-nudge-on-issue-alert")
    @override_options({"slack.nudge-frequency": 1.0})
    def test_slack_nudge_block_is_missing_from_platform(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})

        observation, client = self.send(self.invocation(action))

        sent_blocks = orjson.loads(client.return_value.chat_postMessage.call_args.kwargs["blocks"])
        nudge = sent_blocks[-1]
        assert nudge["type"] == "context"
        assert observation.outcome == ShadowOutcome.MISMATCH
        log = observation.mismatch
        assert log is not None
        first, *_, last = log["diff"]
        assert first == {
            "path": "$.blocks",
            "kind": "length",
            "legacy": len(sent_blocks),
            "platform": len(sent_blocks) - 1,
        }
        assert last == {
            "path": f"$.blocks[{len(sent_blocks) - 1}]",
            "kind": "missing",
            "legacy": nudge,
            "platform": "<missing>",
        }
        assert "$.blocks[0].text.text" in observation.diff_paths

    def test_slack_additional_attachment_is_missing_from_platform(self) -> None:
        attachment = {"type": "section", "text": {"type": "mrkdwn", "text": "extra"}}
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})

        with mock.patch.dict(
            attachment_manager.attachment_generators,
            {ExternalProviders.SLACK: lambda integration, organization: [attachment]},
        ):
            observation, _ = self.send(self.invocation(action))

        assert observation.outcome == ShadowOutcome.MISMATCH
        log = observation.mismatch
        assert log is not None
        first, *_, last = log["diff"]
        assert first["path"] == "$.blocks"
        assert first["kind"] == "length"
        assert first["legacy"] == first["platform"] + 1
        assert last["legacy"] == attachment
        assert last["platform"] == "<missing>"
        assert "$.blocks[0].text.text" in observation.diff_paths

    def test_slack_staging_differs_only_by_event_link(self) -> None:
        action = self.create_shadow_action("slack_staging", {"tags": "level", "notes": ""})

        observation, _ = self.send(self.invocation(action))

        self.assert_event_link_mismatch(observation, "$.blocks[0].text.text")
        assert observation.results[0]["provider"] == "slack_staging"

    def test_discord_differs_only_by_event_link(self) -> None:
        action = self.create_shadow_action("discord", {"tags": "level,foo"})

        observation, client = self.send(self.invocation(action))

        client.return_value.send_message.assert_called_once()
        self.assert_event_link_mismatch(observation, "$.embeds[0].url")

    def test_msteams_matches(self) -> None:
        action = self.create_shadow_action("msteams")

        observation, client = self.send(self.invocation(action))

        client.return_value.send_card.assert_called_once()
        assert observation.outcome == ShadowOutcome.MATCH
        assert observation.mismatch is None

    def test_execute_via_issue_alert_handler(self) -> None:
        action = self.create_shadow_action("msteams")

        with observe_shadow() as observation, mock.patch(MSTEAMS_ISSUE_CLIENT):
            execute_via_issue_alert_handler(self.invocation(action))

        assert observation.outcome == ShadowOutcome.MATCH

    def test_integration_removed_is_not_captured(self) -> None:
        action = self.create_shadow_action("discord", {"tags": ""})
        assert action.integration_id is not None
        action.update(integration_id=action.integration_id + 1000)

        observation, client = self.send(self.invocation(action))

        client.return_value.send_message.assert_not_called()
        assert observation.outcome == ShadowOutcome.LEGACY_NOT_CAPTURED

    def test_compares_when_the_send_raises(self) -> None:
        action = self.create_shadow_action("slack", {"tags": "", "notes": ""})
        error = ApiError("slack is down")

        with (
            observe_shadow() as observation,
            mock.patch(SLACK_ISSUE_CLIENT) as client,
            pytest.raises(Exception) as excinfo,
        ):
            client.return_value.chat_postMessage.side_effect = error
            execute_via_group_type_registry(self.invocation(action))

        assert excinfo.value.__cause__ is error
        self.assert_event_link_mismatch(observation, "$.blocks[0].text.text")

    @mock.patch(f"{RUNNER_PATH}.sentry_sdk.capture_exception")
    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template", side_effect=RuntimeError("platform")
    )
    def test_platform_error_does_not_affect_the_send(
        self, mock_render: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        action = self.create_shadow_action("msteams")

        observation, client = self.send(self.invocation(action))

        client.return_value.send_card.assert_called_once()
        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR
        mock_capture.assert_called_once_with(mock_render.side_effect)

    @override_options({"notifications.platform.shadow-render.sample-rates": {}})
    @mock.patch(f"{RUNNER_PATH}._render_platform")
    def test_not_sampled(self, mock_render: mock.MagicMock) -> None:
        action = self.create_shadow_action("msteams")

        observation, client = self.send(self.invocation(action))

        client.return_value.send_card.assert_called_once()
        assert observation.results == []
        mock_render.assert_not_called()


class ShadowReadMetricAlertTest(ShadowReadTestBase, MetricAlertHandlerBase):
    source = "metric-alert"

    def setUp(self) -> None:
        self.create_models()
        self.enterContext(override_options(SAMPLE_ALL))

    def invocation(self, action: Action) -> ActionInvocation:
        return ActionInvocation(
            event_data=self.event_data,
            action=action,
            detector=self.detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=self.workflow.id,
        )

    def resolution_invocation(self, action: Action) -> ActionInvocation:
        activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data=asdict(self.evidence_data),
        )
        activity.save()
        return ActionInvocation(
            event_data=WorkflowEventData(
                event=activity, workflow_env=self.workflow.environment, group=self.group
            ),
            action=action,
            detector=self.detector,
            notification_uuid=NOTIFICATION_UUID,
            workflow_id=self.workflow.id,
        )

    def assert_match(
        self,
        invocation: ActionInvocation,
        entry: Callable[[ActionInvocation], None] = execute_via_group_type_registry,
    ) -> mock.MagicMock:
        observation, client = self.send(invocation, entry)
        assert observation.outcome == ShadowOutcome.MATCH, observation.mismatch
        return client

    def test_slack_matches(self) -> None:
        action = self.create_shadow_action("slack", {"notes": "Check the runbook"})
        client = self.assert_match(self.invocation(action))
        client.return_value.chat_postMessage.assert_called_once()

    def test_slack_resolution_matches(self) -> None:
        action = self.create_shadow_action("slack", {"notes": "Check the runbook"})
        self.assert_match(self.resolution_invocation(action), execute_via_metric_alert_handler)

    @with_feature("organizations:metric-alert-chartcuterie")
    @mock.patch(
        "sentry.integrations.slack.utils.notifications.build_metric_alert_chart",
        return_value="https://chart.example",
    )
    def test_slack_compares_with_the_chart_that_was_sent(self, mock_chart: mock.MagicMock) -> None:
        action = self.create_shadow_action("slack")

        with mock.patch(
            "sentry.notifications.notification_action.utils.metric_alert_notification_data_factory",
            wraps=metric_alert_notification_data_factory,
        ) as factory:
            client = self.assert_match(self.invocation(action))

        mock_chart.assert_called_once()
        assert factory.call_args.kwargs["chart_url"] == "https://chart.example"
        attachments = client.return_value.chat_postMessage.call_args.kwargs["attachments"]
        assert "https://chart.example" in attachments

    def test_slack_staging_differs_by_referrer(self) -> None:
        action = self.create_shadow_action("slack_staging")

        observation, _ = self.send(self.invocation(action))

        assert observation.outcome == ShadowOutcome.MISMATCH
        log = observation.mismatch
        assert log is not None
        [entry] = log["diff"]
        assert entry["path"] == "$.text"
        assert "referrer=metric_alert_slack&" in entry["legacy"]
        assert "referrer=metric_alert_slack_staging&" in entry["platform"]

    @mock.patch(f"{SLACK_METRIC_HANDLER}._send_via_notification_platform")
    @mock.patch(f"{SLACK_METRIC_HANDLER}.NotificationService.has_access", return_value=True)
    @mock.patch(f"{RUNNER_PATH}._render_platform")
    def test_slack_sent_by_platform_is_not_compared(
        self,
        mock_render: mock.MagicMock,
        mock_has_access: mock.MagicMock,
        mock_platform_send: mock.MagicMock,
    ) -> None:
        action = self.create_shadow_action("slack")

        with mock.patch(
            "sentry.integrations.slack.utils.notifications._build_notification_payload"
        ) as mock_legacy_build:
            observation, client = self.send(self.invocation(action))

        mock_platform_send.assert_called_once()
        mock_legacy_build.assert_not_called()
        client.return_value.chat_postMessage.assert_not_called()
        mock_render.assert_not_called()
        assert observation.outcome == ShadowOutcome.PLATFORM_SENT

    def test_discord_matches(self) -> None:
        action = self.create_shadow_action("discord")
        client = self.assert_match(self.invocation(action))
        client.return_value.send_message.assert_called_once()

    def test_discord_resolution_matches(self) -> None:
        action = self.create_shadow_action("discord")
        self.assert_match(self.resolution_invocation(action), execute_via_metric_alert_handler)

    def test_msteams_matches(self) -> None:
        action = self.create_shadow_action("msteams")
        send = self.assert_match(self.invocation(action))
        send.assert_called_once()

    def test_msteams_resolution_matches(self) -> None:
        action = self.create_shadow_action("msteams")
        self.assert_match(self.resolution_invocation(action), execute_via_metric_alert_handler)

    def test_platform_reuses_the_legacy_context(self) -> None:
        action = self.create_shadow_action("discord")

        with mock.patch(f"{RUNNER_PATH}.IssueNotificationContext") as runner_context_cls:
            self.assert_match(self.invocation(action))

        runner_context_cls.assert_not_called()

    def test_compares_when_the_send_raises(self) -> None:
        action = self.create_shadow_action("msteams")
        error = RuntimeError("rpc failed")

        with (
            observe_shadow() as observation,
            mock.patch(MSTEAMS_METRIC_SEND, side_effect=error),
            pytest.raises(RuntimeError) as excinfo,
        ):
            execute_via_group_type_registry(self.invocation(action))

        assert excinfo.value is error
        assert observation.outcome == ShadowOutcome.MATCH

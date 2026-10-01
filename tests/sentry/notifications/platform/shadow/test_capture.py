from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import replace
from typing import Any
from unittest import mock

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import GroupStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import issue_notification_data_factory
from sentry.notifications.platform.shadow.capture import (
    SHADOW_PROVIDERS,
    LegacyRender,
    _variant,
    collecting,
    record_legacy_render,
    shadow_read,
)
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.issues.test_utils import OccurrenceTestMixin

CAPTURE_PATH = "sentry.notifications.platform.shadow.capture"
VARIANT_DAILY_LIMIT = "notifications.platform.shadow-render.variant-daily-limit"
SAMPLE_ALL = {VARIANT_DAILY_LIMIT: 100}


class ShadowInvocationTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.workflow = self.create_workflow(organization=self.organization)
        self.event = self.store_event(data={"message": "oh no"}, project_id=self.project.id)
        assert self.event.group is not None
        self.issue_group = self.event.group

    def create_invocation(
        self,
        action_type: str = Action.Type.SLACK,
        workflow_id: int | None = None,
        action: Action | None = None,
        data: dict[str, Any] | None = None,
    ) -> ActionInvocation:
        action = action or self.create_action(
            type=action_type,
            integration_id=1234,
            data=data or {},
            config={
                "target_identifier": "C1",
                "target_display": "#alerts",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        return ActionInvocation(
            event_data=WorkflowEventData(
                event=self.event.for_group(self.issue_group), group=self.issue_group
            ),
            action=action,
            detector=self.detector,
            notification_uuid="uuid-1",
            workflow_id=workflow_id if workflow_id is not None else self.workflow.id,
        )


def shadow(
    invocation: ActionInvocation, source: NotificationSource
) -> AbstractContextManager[None]:
    return shadow_read(invocation, source, lambda _: issue_notification_data_factory(invocation))


def _send_legacy(payload: dict[str, Any] | None = None) -> None:
    record_legacy_render(NotificationProviderKey.MSTEAMS, payload or {"type": "AdaptiveCard"})


def test_records_nothing_outside_a_collector() -> None:
    with mock.patch(f"{CAPTURE_PATH}.LegacyRender") as mock_render:
        record_legacy_render(
            NotificationProviderKey.SLACK, {"blocks": []}, chart_url="https://chart"
        )

    mock_render.assert_not_called()


def test_records_the_first_legacy_render() -> None:
    with collecting() as collector:
        record_legacy_render(
            NotificationProviderKey.SLACK, {"text": "first"}, chart_url="https://c"
        )
        record_legacy_render(NotificationProviderKey.DISCORD, {"content": "second"})

    assert collector.legacy_render == LegacyRender(
        provider=NotificationProviderKey.SLACK, payload={"text": "first"}, chart_url="https://c"
    )


def test_record_failures_do_not_propagate() -> None:
    with (
        collecting() as collector,
        mock.patch(f"{CAPTURE_PATH}.LegacyRender", side_effect=RuntimeError("boom")),
        mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
    ):
        record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})

    assert collector.legacy_render is None
    mock_logger.exception.assert_called_once()


def test_context_failures_do_not_propagate() -> None:
    with (
        mock.patch(f"{CAPTURE_PATH}._active_collector") as mock_var,
        mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
    ):
        mock_var.get.side_effect = RuntimeError("boom")
        record_legacy_render(NotificationProviderKey.SLACK, {"blocks": []})

    mock_logger.exception.assert_called_once()


@mock.patch(f"{CAPTURE_PATH}.report")
class ShadowReadSamplingTest(ShadowInvocationTestCase):
    def assert_not_shadowed(
        self,
        mock_report: mock.MagicMock,
        invocation: ActionInvocation,
        source: NotificationSource = NotificationSource.ISSUE,
    ) -> None:
        with shadow(invocation, source):
            _send_legacy()
        mock_report.assert_not_called()

    def test_not_shadowed_without_a_limit(self, mock_report: mock.MagicMock) -> None:
        self.assert_not_shadowed(mock_report, self.create_invocation())

    @override_options({VARIANT_DAILY_LIMIT: 2})
    def test_limit_is_per_variant(self, mock_report: mock.MagicMock) -> None:
        slack = self.create_invocation()
        slack_with_tags = self.create_invocation(data={"tags": "level"})
        discord = self.create_invocation(Action.Type.DISCORD)

        for invocation in (slack, slack, slack, slack_with_tags, discord):
            with shadow(invocation, NotificationSource.ISSUE):
                _send_legacy()

        assert [call.args[2] for call in mock_report.call_args_list] == [
            NotificationProviderKey.SLACK,
            NotificationProviderKey.SLACK,
            NotificationProviderKey.SLACK,
            NotificationProviderKey.DISCORD,
        ]

    @override_options(SAMPLE_ALL)
    def test_metric_alert_without_metric_evidence_is_not_shadowed(
        self, mock_report: mock.MagicMock
    ) -> None:
        with mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger:
            self.assert_not_shadowed(
                mock_report, self.create_invocation(), NotificationSource.METRIC_ALERT
            )
        mock_logger.exception.assert_called_once()

    @override_options(SAMPLE_ALL)
    def test_skips_test_notification_workflow(self, mock_report: mock.MagicMock) -> None:
        invocation = self.create_invocation(workflow_id=TEST_NOTIFICATION_ID)
        self.assert_not_shadowed(mock_report, invocation)

    @override_options(SAMPLE_ALL)
    def test_skips_test_notification_action(self, mock_report: mock.MagicMock) -> None:
        action = Action(id=TEST_NOTIFICATION_ID, type=Action.Type.SLACK, integration_id=1234)
        self.assert_not_shadowed(mock_report, self.create_invocation(action=action))

    @override_options(SAMPLE_ALL)
    def test_skips_unsupported_action_types(self, mock_report: mock.MagicMock) -> None:
        for action_type in (Action.Type.EMAIL, Action.Type.PAGERDUTY, Action.Type.WEBHOOK):
            invocation = self.create_invocation(action=Action(id=4242, type=action_type))
            self.assert_not_shadowed(mock_report, invocation, NotificationSource.ISSUE)
            self.assert_not_shadowed(mock_report, invocation, NotificationSource.METRIC_ALERT)

    @override_options(SAMPLE_ALL)
    def test_skips_unsupported_sources(self, mock_report: mock.MagicMock) -> None:
        self.assert_not_shadowed(
            mock_report, self.create_invocation(), NotificationSource.ACTIVITY_SET_RESOLVED
        )

    @override_options(SAMPLE_ALL)
    def test_supported_action_types(self, mock_report: mock.MagicMock) -> None:
        expected = {
            Action.Type.SLACK: NotificationProviderKey.SLACK,
            Action.Type.SLACK_STAGING: NotificationProviderKey.SLACK_STAGING,
            Action.Type.DISCORD: NotificationProviderKey.DISCORD,
            Action.Type.MSTEAMS: NotificationProviderKey.MSTEAMS,
        }
        for action_type in expected:
            with shadow(self.create_invocation(action_type), NotificationSource.ISSUE):
                _send_legacy()

        assert [call.args[2] for call in mock_report.call_args_list] == list(expected.values())

    def test_variant_failure_does_not_propagate(self, mock_report: mock.MagicMock) -> None:
        with (
            override_options(SAMPLE_ALL),
            mock.patch(f"{CAPTURE_PATH}._variant", side_effect=RuntimeError("bad group")),
            mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
        ):
            self.assert_not_shadowed(mock_report, self.create_invocation())

        mock_logger.exception.assert_called_once()

    def test_sampling_failure_does_not_propagate(self, mock_report: mock.MagicMock) -> None:
        with (
            mock.patch(f"{CAPTURE_PATH}.options.get", side_effect=RuntimeError("no options")),
            mock.patch(f"{CAPTURE_PATH}.logger") as mock_logger,
        ):
            self.assert_not_shadowed(mock_report, self.create_invocation())

        mock_logger.exception.assert_called_once()


class IssueVariantTest(ShadowInvocationTestCase, OccurrenceTestMixin):
    def variant(self, invocation: ActionInvocation) -> str:
        provider_key = SHADOW_PROVIDERS[invocation.action.type]
        return _variant(invocation, NotificationSource.ISSUE, provider_key)

    def test_error_issue(self) -> None:
        assert (
            self.variant(self.create_invocation())
            == "issue:slack:error:event:no_tags:no_notes:unresolved:new:no_env"
        )

    def test_action_config(self) -> None:
        invocation = self.create_invocation(data={"tags": "level,foo", "notes": "@on-call"})
        assert (
            self.variant(invocation) == "issue:slack:error:event:tags:notes:unresolved:new:no_env"
        )

    def test_blank_action_config(self) -> None:
        invocation = self.create_invocation(data={"tags": "", "notes": ""})
        assert (
            self.variant(invocation)
            == "issue:slack:error:event:no_tags:no_notes:unresolved:new:no_env"
        )

    def test_group_status(self) -> None:
        for status, name in (
            (GroupStatus.RESOLVED, "resolved"),
            (GroupStatus.IGNORED, "ignored"),
            (GroupStatus.PENDING_DELETION, "unresolved"),
        ):
            self.issue_group.status = status
            assert f":{name}:" in self.variant(self.create_invocation())

    def test_substatus_and_environment(self) -> None:
        self.issue_group.substatus = GroupSubStatus.ONGOING
        invocation = self.create_invocation()
        invocation = replace(
            invocation,
            event_data=replace(invocation.event_data, workflow_env=self.environment),
        )
        assert self.variant(invocation).endswith(":unresolved:not_new:env")

    def test_occurrence_issue(self) -> None:
        self.issue_group.type = FeedbackGroup.type_id
        invocation = self.create_invocation(Action.Type.MSTEAMS)
        event = invocation.event_data.event
        assert isinstance(event, GroupEvent)
        event.occurrence = self.build_occurrence(type=FeedbackGroup.type_id)

        assert (
            self.variant(invocation)
            == "issue:msteams:feedback:occurrence:no_tags:no_notes:unresolved:new:no_env"
        )

from __future__ import annotations

from collections.abc import Callable, Generator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any
from unittest import mock

import pytest
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.grouping.grouptype import ErrorGroupType
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.group_type_notification_registry.handlers.issue_alert_registry_handler import (
    IssueAlertRegistryHandler,
)
from sentry.notifications.notification_action.group_type_notification_registry.handlers.metric_alert_registry_handler import (
    MetricAlertRegistryHandler,
)
from sentry.notifications.notification_action.utils import (
    execute_via_issue_alert_handler,
    execute_via_metric_alert_handler,
)
from sentry.notifications.platform.shadow.capture import (
    is_collecting,
    record_legacy_render,
    record_platform_send,
)
from sentry.notifications.platform.shadow.runner import ShadowOutcome, shadow_read
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData

RUNNER_PATH = "sentry.notifications.platform.shadow.runner"
SAMPLE_RATES = "notifications.platform.shadow-render.sample-rates"
KILLSWITCH = "notifications.platform.killswitch.sources"
SAMPLE_ALL = {SAMPLE_RATES: {"issue": 1.0, "metric-alert": 1.0}}


@dataclass
class ShadowObservation:
    results: list[dict[str, str]] = field(default_factory=list)
    mismatch_logs: list[dict[str, Any]] = field(default_factory=list)

    @property
    def outcome(self) -> str:
        [result] = self.results
        return result["outcome"]

    @property
    def mismatch(self) -> dict[str, Any] | None:
        assert len(self.mismatch_logs) <= 1
        return self.mismatch_logs[0] if self.mismatch_logs else None

    @property
    def diff_paths(self) -> list[str]:
        return [entry["path"] for entry in self.mismatch["diff"]] if self.mismatch else []


@contextmanager
def observe_shadow() -> Generator[ShadowObservation]:
    observation = ShadowObservation()
    with (
        mock.patch(f"{RUNNER_PATH}.metrics") as mock_metrics,
        mock.patch(f"{RUNNER_PATH}.logger") as mock_logger,
    ):
        try:
            yield observation
        finally:
            observation.results = [
                call.kwargs["tags"]
                for call in mock_metrics.incr.call_args_list
                if call.args[0] == "notifications.platform.shadow.result"
            ]
            observation.mismatch_logs = [
                call.kwargs["extra"]
                for call in mock_logger.info.call_args_list
                if call.args[0] == "notifications.platform.shadow.mismatch"
            ]


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
    ) -> ActionInvocation:
        action = action or self.create_action(
            type=action_type,
            integration_id=1234,
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


def _send_legacy(payload: dict[str, Any] | None = None) -> None:
    record_legacy_render(NotificationProviderKey.MSTEAMS, payload or {"type": "AdaptiveCard"})


@mock.patch(f"{RUNNER_PATH}.compare_with_platform")
class ShadowReadSamplingTest(ShadowInvocationTestCase):
    def assert_not_shadowed(
        self,
        mock_compare: mock.MagicMock,
        invocation: ActionInvocation,
        source: NotificationSource = NotificationSource.ISSUE,
    ) -> None:
        with shadow_read(invocation, source):
            assert not is_collecting()
            _send_legacy()
        mock_compare.assert_not_called()

    def test_no_collector_without_a_sample_rate(self, mock_compare: mock.MagicMock) -> None:
        self.assert_not_shadowed(mock_compare, self.create_invocation())

    @override_options({SAMPLE_RATES: {"issue": 0.0, "metric-alert": 1.0}})
    def test_samples_per_source(self, mock_compare: mock.MagicMock) -> None:
        invocation = self.create_invocation(action_type=Action.Type.DISCORD)
        self.assert_not_shadowed(mock_compare, invocation, NotificationSource.ISSUE)

        with shadow_read(invocation, NotificationSource.METRIC_ALERT):
            assert is_collecting()

        mock_compare.assert_called_once()
        args = mock_compare.call_args.args
        assert args[1:3] == (NotificationSource.METRIC_ALERT, NotificationProviderKey.DISCORD)

    @override_options({SAMPLE_RATES: {"issue": 0.25}})
    def test_sample_rate_is_applied(self, mock_compare: mock.MagicMock) -> None:
        invocation = self.create_invocation()

        with mock.patch(f"{RUNNER_PATH}.random.random", return_value=0.3):
            self.assert_not_shadowed(mock_compare, invocation)

        with mock.patch(f"{RUNNER_PATH}.random.random", return_value=0.2):
            with shadow_read(invocation, NotificationSource.ISSUE):
                _send_legacy()
        mock_compare.assert_called_once()

    @override_options({**SAMPLE_ALL, KILLSWITCH: ["issue"]})
    def test_killswitch(self, mock_compare: mock.MagicMock) -> None:
        self.assert_not_shadowed(mock_compare, self.create_invocation())

    @override_options(SAMPLE_ALL)
    def test_skips_test_notification_workflow(self, mock_compare: mock.MagicMock) -> None:
        invocation = self.create_invocation(workflow_id=TEST_NOTIFICATION_ID)
        self.assert_not_shadowed(mock_compare, invocation)

    @override_options(SAMPLE_ALL)
    def test_skips_test_notification_action(self, mock_compare: mock.MagicMock) -> None:
        action = Action(id=TEST_NOTIFICATION_ID, type=Action.Type.SLACK, integration_id=1234)
        self.assert_not_shadowed(mock_compare, self.create_invocation(action=action))

    @override_options(SAMPLE_ALL)
    def test_skips_unsupported_action_types(self, mock_compare: mock.MagicMock) -> None:
        for action_type in (Action.Type.EMAIL, Action.Type.PAGERDUTY, Action.Type.WEBHOOK):
            invocation = self.create_invocation(action=Action(id=4242, type=action_type))
            self.assert_not_shadowed(mock_compare, invocation, NotificationSource.ISSUE)
            self.assert_not_shadowed(mock_compare, invocation, NotificationSource.METRIC_ALERT)

    @override_options({SAMPLE_RATES: {"activity-set-resolved": 1.0}})
    def test_skips_unsupported_sources(self, mock_compare: mock.MagicMock) -> None:
        self.assert_not_shadowed(
            mock_compare, self.create_invocation(), NotificationSource.ACTIVITY_SET_RESOLVED
        )

    @override_options(SAMPLE_ALL)
    def test_supported_action_types(self, mock_compare: mock.MagicMock) -> None:
        expected = {
            Action.Type.SLACK: NotificationProviderKey.SLACK,
            Action.Type.SLACK_STAGING: NotificationProviderKey.SLACK_STAGING,
            Action.Type.DISCORD: NotificationProviderKey.DISCORD,
            Action.Type.MSTEAMS: NotificationProviderKey.MSTEAMS,
        }
        for action_type in expected:
            with shadow_read(self.create_invocation(action_type), NotificationSource.ISSUE):
                assert is_collecting()

        assert [call.args[2] for call in mock_compare.call_args_list] == list(expected.values())

    @override_options(SAMPLE_ALL)
    def test_nested_shadow_reads_compare_once(self, mock_compare: mock.MagicMock) -> None:
        invocation = self.create_invocation()

        with shadow_read(invocation, NotificationSource.ISSUE):
            with shadow_read(invocation, NotificationSource.ISSUE):
                with shadow_read(invocation, NotificationSource.METRIC_ALERT):
                    _send_legacy()

        mock_compare.assert_called_once()
        collector = mock_compare.call_args.args[3]
        assert collector.legacy.payload == {"type": "AdaptiveCard"}

    def test_sampling_failure_does_not_propagate(self, mock_compare: mock.MagicMock) -> None:
        with (
            mock.patch(f"{RUNNER_PATH}.options.get", side_effect=RuntimeError("no options")),
            mock.patch(f"{RUNNER_PATH}.logger") as mock_logger,
        ):
            self.assert_not_shadowed(mock_compare, self.create_invocation())

        mock_logger.exception.assert_called_once()


class ShadowReadOutcomeTest(ShadowInvocationTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(SAMPLE_ALL))

    def test_legacy_not_captured(self) -> None:
        with observe_shadow() as observation:
            with shadow_read(self.create_invocation(), NotificationSource.ISSUE):
                pass

        assert observation.outcome == ShadowOutcome.LEGACY_NOT_CAPTURED

    @mock.patch(f"{RUNNER_PATH}._render_platform")
    def test_platform_sent_skips_the_platform_render(self, mock_render: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with shadow_read(self.create_invocation(), NotificationSource.METRIC_ALERT):
                record_platform_send()

        assert observation.outcome == ShadowOutcome.PLATFORM_SENT
        mock_render.assert_not_called()

    @mock.patch(f"{RUNNER_PATH}.renderer_registry.get", return_value=None)
    @mock.patch(f"{RUNNER_PATH}._render_platform")
    def test_no_renderer(self, mock_render: mock.MagicMock, mock_get: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with shadow_read(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.NO_RENDERER
        mock_render.assert_not_called()

    @mock.patch(f"{RUNNER_PATH}.sentry_sdk.capture_exception")
    @mock.patch(f"{RUNNER_PATH}._render_platform", side_effect=RuntimeError("platform"))
    def test_platform_error_is_captured(
        self, mock_render: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        with observe_shadow() as observation:
            with shadow_read(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR
        mock_capture.assert_called_once_with(mock_render.side_effect)

    @mock.patch(f"{RUNNER_PATH}.sentry_sdk.capture_exception")
    @mock.patch(f"{RUNNER_PATH}.diff", side_effect=RuntimeError("compare"))
    @mock.patch(f"{RUNNER_PATH}._render_platform", return_value={"type": "AdaptiveCard"})
    def test_compare_error_is_captured(
        self, mock_render: mock.MagicMock, mock_diff: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        with observe_shadow() as observation:
            with shadow_read(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.COMPARE_ERROR
        mock_capture.assert_called_once_with(mock_diff.side_effect)

    @mock.patch(f"{RUNNER_PATH}._render_platform", return_value={"type": "AdaptiveCard"})
    def test_match_records_timing(self, mock_render: mock.MagicMock) -> None:
        with mock.patch(f"{RUNNER_PATH}.metrics") as mock_metrics:
            with shadow_read(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        mock_metrics.timer.assert_called_once_with(
            "notifications.platform.shadow.duration",
            tags={"source": "issue", "provider": "msteams"},
            sample_rate=1.0,
        )
        mock_metrics.incr.assert_called_once_with(
            "notifications.platform.shadow.result",
            tags={"source": "issue", "provider": "msteams", "outcome": "match"},
            sample_rate=1.0,
        )

    @mock.patch(f"{RUNNER_PATH}._render_platform", return_value={"type": "Card", "extra": 1})
    def test_mismatch_log(self, mock_render: mock.MagicMock) -> None:
        invocation = self.create_invocation(Action.Type.MSTEAMS)

        with observe_shadow() as observation:
            with shadow_read(invocation, NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.MISMATCH
        assert observation.mismatch == {
            "source": "issue",
            "provider": "msteams",
            "action_id": invocation.action.id,
            "workflow_id": self.workflow.id,
            "organization_id": self.organization.id,
            "group_id": self.issue_group.id,
            "detector_id": self.detector.id,
            "diff_count": 2,
            "diff": [
                {"path": "$.extra", "kind": "missing", "legacy": "<missing>", "platform": 1},
                {"path": "$.type", "kind": "value", "legacy": "AdaptiveCard", "platform": "Card"},
            ],
        }

    @override_options({"notifications.platform.shadow-render.max-diff-entries": 1})
    @mock.patch(f"{RUNNER_PATH}._render_platform", return_value={"type": "Card", "extra": 1})
    def test_mismatch_log_is_limited_to_max_diff_entries(self, mock_render: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with shadow_read(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.mismatch is not None
        assert observation.mismatch["diff_count"] == 2
        assert observation.diff_paths == ["$.extra"]

    @mock.patch(f"{RUNNER_PATH}._render_platform", return_value={"type": "AdaptiveCard"})
    def test_compares_when_the_send_raises(self, mock_render: mock.MagicMock) -> None:
        error = RuntimeError("send failed")

        with observe_shadow() as observation:
            with pytest.raises(RuntimeError) as excinfo:
                with shadow_read(
                    self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE
                ):
                    _send_legacy()
                    raise error

        assert excinfo.value is error
        assert observation.outcome == ShadowOutcome.MATCH

    @mock.patch(f"{RUNNER_PATH}._render_platform", side_effect=ValueError("platform"))
    def test_send_exception_is_not_replaced_by_a_shadow_error(
        self, mock_render: mock.MagicMock
    ) -> None:
        with observe_shadow() as observation:
            with pytest.raises(RuntimeError, match="send failed"):
                with shadow_read(
                    self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE
                ):
                    _send_legacy()
                    raise RuntimeError("send failed")

        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR

    @mock.patch(f"{RUNNER_PATH}._render_platform")
    def test_no_compare_after_processing_deadline(self, mock_render: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with pytest.raises(ProcessingDeadlineExceeded):
                with shadow_read(self.create_invocation(), NotificationSource.ISSUE):
                    _send_legacy()
                    raise ProcessingDeadlineExceeded()

        assert observation.results == []
        mock_render.assert_not_called()

    def test_report_failure_does_not_propagate(self) -> None:
        with (
            mock.patch(f"{RUNNER_PATH}.metrics") as mock_metrics,
            mock.patch(f"{RUNNER_PATH}.logger") as mock_logger,
        ):
            mock_metrics.timer.side_effect = RuntimeError("statsd is down")
            with shadow_read(self.create_invocation(), NotificationSource.ISSUE):
                _send_legacy()

        mock_logger.exception.assert_called_once()
        assert (
            mock_logger.exception.call_args.args[0] == "notifications.platform.shadow.report_failed"
        )


class ShadowHookTest(ShadowInvocationTestCase):
    """
    Every place the workflow engine hands an issue or metric alert to the legacy registry runs the
    send inside a shadow read, with the registry lookup outside of it.
    """

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options(SAMPLE_ALL))

    ISSUE_HANDLER_MODULE = "sentry.notifications.notification_action.group_type_notification_registry.handlers.issue_alert_registry_handler"
    METRIC_HANDLER_MODULE = "sentry.notifications.notification_action.group_type_notification_registry.handlers.metric_alert_registry_handler"
    UTILS_MODULE = "sentry.notifications.notification_action.utils"

    def assert_send_is_shadowed(
        self,
        run: Callable[[ActionInvocation], None],
        registry_path: str,
        source: NotificationSource,
    ) -> None:
        invocation = self.create_invocation(Action.Type.MSTEAMS)
        handler = mock.Mock()

        def send(inv: ActionInvocation) -> None:
            assert is_collecting()
            _send_legacy()

        handler.invoke_legacy_registry.side_effect = send

        with (
            mock.patch(f"{registry_path}.get", return_value=handler),
            mock.patch(f"{RUNNER_PATH}.compare_with_platform") as mock_compare,
        ):
            run(invocation)

        handler.invoke_legacy_registry.assert_called_once_with(invocation)
        mock_compare.assert_called_once()
        assert mock_compare.call_args.args[:3] == (
            invocation,
            source,
            NotificationProviderKey.MSTEAMS,
        )

    def assert_lookup_failure_is_not_shadowed(
        self, run: Callable[[ActionInvocation], None], registry_path: str
    ) -> None:
        with (
            mock.patch(f"{registry_path}.get", side_effect=NoRegistrationExistsError),
            mock.patch(f"{RUNNER_PATH}.compare_with_platform") as mock_compare,
        ):
            with pytest.raises(NoRegistrationExistsError):
                run(self.create_invocation())

        mock_compare.assert_not_called()

    def test_execute_via_issue_alert_handler(self) -> None:
        registry = f"{self.UTILS_MODULE}.issue_alert_handler_registry"
        self.assert_send_is_shadowed(
            execute_via_issue_alert_handler, registry, NotificationSource.ISSUE
        )
        self.assert_lookup_failure_is_not_shadowed(execute_via_issue_alert_handler, registry)

    def test_execute_via_metric_alert_handler(self) -> None:
        registry = f"{self.UTILS_MODULE}.metric_alert_handler_registry"
        self.assert_send_is_shadowed(
            execute_via_metric_alert_handler, registry, NotificationSource.METRIC_ALERT
        )
        self.assert_lookup_failure_is_not_shadowed(execute_via_metric_alert_handler, registry)

    def test_issue_alert_registry_handler(self) -> None:
        registry = f"{self.ISSUE_HANDLER_MODULE}.issue_alert_handler_registry"
        run = IssueAlertRegistryHandler.handle_workflow_action
        self.assert_send_is_shadowed(run, registry, NotificationSource.ISSUE)
        self.assert_lookup_failure_is_not_shadowed(run, registry)

    def test_metric_alert_registry_handler(self) -> None:
        registry = f"{self.METRIC_HANDLER_MODULE}.metric_alert_handler_registry"
        run = MetricAlertRegistryHandler.handle_workflow_action
        self.assert_send_is_shadowed(run, registry, NotificationSource.METRIC_ALERT)
        self.assert_lookup_failure_is_not_shadowed(run, registry)

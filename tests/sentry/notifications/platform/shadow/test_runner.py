from __future__ import annotations

import re
from collections.abc import Generator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass, field
from typing import Any
from unittest import mock

import pytest
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.grouping.grouptype import ErrorGroupType
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import issue_notification_data_factory
from sentry.notifications.platform.shadow.capture import (
    LegacyRender,
    record_legacy_render,
)
from sentry.notifications.platform.shadow.runner import ShadowOutcome, _diff, shadow_read
from sentry.notifications.platform.types import NotificationProviderKey, NotificationSource
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData

RUNNER_PATH = "sentry.notifications.platform.shadow.runner"
SAMPLE_RATES = "notifications.platform.shadow-render.sample-rates"
KILLSWITCH = "notifications.platform.killswitch.sources"
SAMPLE_ALL = {SAMPLE_RATES: {"issue": 1.0, "metric-alert": 1.0}}

_PATH_STEP = re.compile(r"(?:^|\.)(\w+)|\[(\d+)\]")


def resolve(payload: Any, path: str) -> Any:
    """
    Returns the value at a diff path like `blocks[0].text.text`.
    """
    value = payload
    for key, index in _PATH_STEP.findall(path):
        value = value[key] if key else value[int(index)]
    return value


@dataclass
class ShadowObservation:
    results: list[dict[str, str]] = field(default_factory=list)
    mismatch_logs: list[dict[str, Any]] = field(default_factory=list)
    compared: list[tuple[Any, Any]] = field(default_factory=list)

    @property
    def payloads(self) -> tuple[Any, Any]:
        """
        The normalized legacy and platform payloads that were diffed.
        """
        [pair] = self.compared
        return pair

    @property
    def outcome(self) -> str:
        [result] = self.results
        return result["outcome"]

    @property
    def mismatch(self) -> dict[str, Any] | None:
        assert len(self.mismatch_logs) <= 1
        return self.mismatch_logs[0] if self.mismatch_logs else None


@contextmanager
def observe_shadow() -> Generator[ShadowObservation]:
    observation = ShadowObservation()
    with (
        mock.patch(f"{RUNNER_PATH}.metrics") as mock_metrics,
        mock.patch(f"{RUNNER_PATH}.logger") as mock_logger,
        mock.patch(f"{RUNNER_PATH}._diff", wraps=_diff) as mock_diff,
    ):
        try:
            yield observation
        finally:
            observation.compared = [
                (call.args[0], call.args[1]) for call in mock_diff.call_args_list
            ]
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


def shadow(
    invocation: ActionInvocation, source: NotificationSource
) -> AbstractContextManager[None]:
    return shadow_read(invocation, source, lambda _: issue_notification_data_factory(invocation))


def _send_legacy(payload: dict[str, Any] | None = None) -> None:
    record_legacy_render(NotificationProviderKey.MSTEAMS, payload or {"type": "AdaptiveCard"})


def test_diff_excludes_values() -> None:
    legacy = {"text": "user@example.com", "tags": [{"value": "10.0.0.1"}], "level": "fatal"}
    platform = {"text": "other@example.com", "level": "warning"}
    entries = _diff(legacy, platform)

    assert entries == [
        "level: old=str(len=5), new=str(len=7)",
        "Missing from new: tags",
        "text: old=str(len=16), new=str(len=17)",
    ]
    for value in ("example.com", "10.0.0.1", "fatal", "warning"):
        assert all(value not in entry for entry in entries)


@mock.patch(f"{RUNNER_PATH}._compare_with_platform")
class ShadowReadSamplingTest(ShadowInvocationTestCase):
    def assert_not_shadowed(
        self,
        mock_compare: mock.MagicMock,
        invocation: ActionInvocation,
        source: NotificationSource = NotificationSource.ISSUE,
    ) -> None:
        with shadow(invocation, source):
            _send_legacy()
        mock_compare.assert_not_called()

    def test_no_collector_without_a_sample_rate(self, mock_compare: mock.MagicMock) -> None:
        self.assert_not_shadowed(mock_compare, self.create_invocation())

    @override_options({SAMPLE_RATES: {"issue": 0.0, "metric-alert": 1.0}})
    def test_samples_per_source(self, mock_compare: mock.MagicMock) -> None:
        invocation = self.create_invocation(action_type=Action.Type.DISCORD)
        self.assert_not_shadowed(mock_compare, invocation, NotificationSource.ISSUE)

        with shadow(invocation, NotificationSource.METRIC_ALERT):
            _send_legacy()

        mock_compare.assert_called_once()
        args = mock_compare.call_args.args
        assert args[:2] == (NotificationSource.METRIC_ALERT, NotificationProviderKey.DISCORD)

    @override_options({SAMPLE_RATES: {"issue": 0.25}})
    def test_sample_rate_is_applied(self, mock_compare: mock.MagicMock) -> None:
        invocation = self.create_invocation()

        with mock.patch(f"{RUNNER_PATH}.random.random", return_value=0.3):
            self.assert_not_shadowed(mock_compare, invocation)

        with mock.patch(f"{RUNNER_PATH}.random.random", return_value=0.2):
            with shadow(invocation, NotificationSource.ISSUE):
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
            with shadow(self.create_invocation(action_type), NotificationSource.ISSUE):
                _send_legacy()

        assert [call.args[1] for call in mock_compare.call_args_list] == list(expected.values())

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
        build_data = mock.Mock()

        with observe_shadow() as observation:
            with shadow_read(self.create_invocation(), NotificationSource.ISSUE, build_data):
                pass

        assert observation.outcome == ShadowOutcome.LEGACY_NOT_CAPTURED
        build_data.assert_not_called()

    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template", return_value={"type": "AdaptiveCard"}
    )
    def test_renders_the_data_built_from_the_legacy_render(
        self, mock_render: mock.MagicMock
    ) -> None:
        invocation = self.create_invocation(Action.Type.MSTEAMS)
        build_data = mock.Mock(return_value=issue_notification_data_factory(invocation))

        with observe_shadow() as observation:
            with shadow_read(invocation, NotificationSource.ISSUE, build_data):
                record_legacy_render(
                    NotificationProviderKey.MSTEAMS, {"type": "AdaptiveCard"}, chart_url="https://c"
                )

        assert observation.outcome == ShadowOutcome.MATCH
        build_data.assert_called_once_with(
            LegacyRender(
                provider=NotificationProviderKey.MSTEAMS,
                payload={"type": "AdaptiveCard"},
                chart_url="https://c",
            )
        )
        assert mock_render.call_args.kwargs["data"] is build_data.return_value

    @mock.patch(f"{RUNNER_PATH}.renderer_registry.get", return_value=None)
    @mock.patch(f"{RUNNER_PATH}.NotificationService.render_template")
    def test_no_renderer(self, mock_render: mock.MagicMock, mock_get: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.NO_RENDERER
        mock_render.assert_not_called()

    @mock.patch(f"{RUNNER_PATH}.sentry_sdk.capture_exception")
    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template", side_effect=RuntimeError("platform")
    )
    def test_platform_error_is_captured(
        self, mock_render: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        with observe_shadow() as observation:
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR
        mock_capture.assert_called_once_with(mock_render.side_effect)

    @mock.patch(f"{RUNNER_PATH}.sentry_sdk.capture_exception")
    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template", return_value={"type": "AdaptiveCard"}
    )
    def test_compare_error_is_captured(
        self, mock_render: mock.MagicMock, mock_capture: mock.MagicMock
    ) -> None:
        with (
            observe_shadow() as observation,
            mock.patch(f"{RUNNER_PATH}._diff", side_effect=RuntimeError("compare")) as mock_diff,
        ):
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                _send_legacy()

        assert observation.outcome == ShadowOutcome.COMPARE_ERROR
        mock_capture.assert_called_once_with(mock_diff.side_effect)

    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template", return_value={"type": "AdaptiveCard"}
    )
    def test_match_records_timing(self, mock_render: mock.MagicMock) -> None:
        with mock.patch(f"{RUNNER_PATH}.metrics") as mock_metrics:
            with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
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

    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template",
        return_value={"type": "Card", "extra": 1},
    )
    def test_mismatch_log(self, mock_render: mock.MagicMock) -> None:
        invocation = self.create_invocation(Action.Type.MSTEAMS)

        with observe_shadow() as observation:
            with shadow(invocation, NotificationSource.ISSUE):
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
            "diff": ["Extra in new: extra", "type: old=str(len=12), new=str(len=4)"],
        }

    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template", return_value={"type": "AdaptiveCard"}
    )
    def test_compares_when_the_send_raises(self, mock_render: mock.MagicMock) -> None:
        error = RuntimeError("send failed")

        with observe_shadow() as observation:
            with pytest.raises(RuntimeError) as excinfo:
                with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                    _send_legacy()
                    raise error

        assert excinfo.value is error
        assert observation.outcome == ShadowOutcome.MATCH

    @mock.patch(
        f"{RUNNER_PATH}.NotificationService.render_template", side_effect=ValueError("platform")
    )
    def test_send_exception_is_not_replaced_by_a_shadow_error(
        self, mock_render: mock.MagicMock
    ) -> None:
        with observe_shadow() as observation:
            with pytest.raises(RuntimeError, match="send failed"):
                with shadow(self.create_invocation(Action.Type.MSTEAMS), NotificationSource.ISSUE):
                    _send_legacy()
                    raise RuntimeError("send failed")

        assert observation.outcome == ShadowOutcome.PLATFORM_ERROR

    @mock.patch(f"{RUNNER_PATH}.NotificationService.render_template")
    def test_no_compare_after_processing_deadline(self, mock_render: mock.MagicMock) -> None:
        with observe_shadow() as observation:
            with pytest.raises(ProcessingDeadlineExceeded):
                with shadow(self.create_invocation(), NotificationSource.ISSUE):
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
            with shadow(self.create_invocation(), NotificationSource.ISSUE):
                _send_legacy()

        mock_logger.exception.assert_called_once()
        assert (
            mock_logger.exception.call_args.args[0] == "notifications.platform.shadow.report_failed"
        )

from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.evaluations import (
    DataConditionGroupEvaluation,
    WorkflowEvaluation,
)
from sentry.workflow_engine.processors.evaluations.workflow import (
    log_workflow_evaluations,
)
from sentry.workflow_engine.types import ConditionError, WorkflowEventData

LOG_MODULE = "sentry.workflow_engine.processors.evaluations.workflow"


class TestWorkflowEvaluationLog(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)
        self.event_data = WorkflowEventData(event=self.event, group=self.event.group)

    def _build_evaluation(
        self, *, triggered: bool = False, error: ConditionError | None = None
    ) -> WorkflowEvaluation:
        trigger_evaluation = DataConditionGroupEvaluation(
            result=triggered,
            triggered=triggered,
            error=error,
            data={
                "condition_evaluations": [],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )
        return WorkflowEvaluation(
            result=[],
            triggered=triggered,
            error=error,
            data={
                "trigger_group_eval": trigger_evaluation,
                "filter_group_evals": [],
                "event": self.event_data,
            },
        )

    def test_to_log_flattens_evaluation(self) -> None:
        evaluation = self._build_evaluation(
            triggered=True, error=ConditionError(msg="evaluation failed")
        )

        assert evaluation.to_log() == {
            "triggered": True,
            "error": "evaluation failed",
            "triggered_action_ids": [],
            "deferred": False,
        }

    def test_always_logs_with_feature_enabled(self) -> None:
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
        ):
            assert log_workflow_evaluations(
                mock_logger,
                organization=self.organization,
                event_data=self.event_data,
                evaluations={},
            )

        mock_logger.info.assert_called_once()

    def test_respects_sample_rate_when_feature_disabled(self) -> None:
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": False}),
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.1,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(f"{LOG_MODULE}.random.random", side_effect=[0.05, 0.15]),
        ):
            assert log_workflow_evaluations(
                mock_logger,
                organization=self.organization,
                event_data=self.event_data,
                evaluations={},
            )
            assert not log_workflow_evaluations(
                mock_logger,
                organization=self.organization,
                event_data=self.event_data,
                evaluations={},
            )

        mock_logger.info.assert_called_once()

    def test_logs_flattened_batch_to_sentry_logger(self) -> None:
        evaluation = self._build_evaluation(triggered=True)
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}),
            mock.patch(f"{LOG_MODULE}.sentry_logger") as mock_sentry_logger,
        ):
            assert log_workflow_evaluations(
                mock_logger,
                organization=self.organization,
                event_data=self.event_data,
                evaluations={10: evaluation},
                workflow_ids=[10],
                action_filter_group_ids=[30],
                delayed_conditions=["buffer-key"],
                debug_msg="debug message",
            )

        mock_sentry_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation.workflows.triggered",
            attributes={
                "event_id": self.event.event_id,
                "group_id": self.event.group.id,
                "detection_type": None,
                "workflow_ids": [10],
                "triggered_workflow_ids": [10],
                "delayed_conditions": ["buffer-key"],
                "action_filter_group_ids": [30],
                "triggered_action_ids": [],
                "debug_msg": "debug message",
            },
        )
        mock_logger.info.assert_not_called()

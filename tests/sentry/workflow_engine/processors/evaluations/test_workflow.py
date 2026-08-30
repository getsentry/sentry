from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.evaluation_logging import (
    emit_workflow_evaluation_logs,
    should_log,
)
from sentry.workflow_engine.processors.evaluations import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    DeferredWorkflowEvaluationResult,
    EvaluationPhase,
    EvaluationType,
    ProcessWorkflowsResult,
    WorkflowEvaluation,
    WorkflowEvaluationOutcome,
)
from sentry.workflow_engine.types import ConditionError, WorkflowEventData

LOGGING_MODULE = "sentry.workflow_engine.processors.evaluation_logging"


class TestWorkflowEvaluationArtifact(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)
        self.group = self.event.group
        assert self.group is not None

        self.event_data = WorkflowEventData(
            event=self.event.for_group(self.group),
            group=self.group,
        )
        self.detector = self.create_detector(project=self.project)

    def _build_evaluation(
        self,
        *,
        triggered: bool = False,
        error: ConditionError | None = None,
        deferred: bool = False,
        workflow_id: int = 10,
        filter_group_evaluations: list[DataConditionGroupEvaluation] | None = None,
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
            workflow_id=workflow_id,
            detector_id=self.detector.id,
            detector_type=self.detector.type,
            result=(
                DeferredWorkflowEvaluationResult(
                    delayed_when_group_id=20,
                    delayed_if_group_ids=frozenset({30}),
                    passing_if_group_ids=frozenset({40}),
                )
                if deferred
                else []
            ),
            triggered=triggered,
            error=error,
            data={
                "trigger_group_eval": trigger_evaluation,
                "filter_group_evals": filter_group_evaluations or [],
                "event": self.event_data,
            },
        )

    def _build_batch_result(
        self,
        evaluations: dict[int, WorkflowEvaluation] | None = None,
        *,
        outcome: WorkflowEvaluationOutcome = WorkflowEvaluationOutcome.COMPLETED,
    ) -> ProcessWorkflowsResult:
        return ProcessWorkflowsResult(
            evaluations=evaluations or {},
            outcome=outcome,
            project_id=self.project.id,
            group_id=self.group.id,
            event_id=self.event.event_id,
            detector_id=self.detector.id,
            detector_type=self.detector.type,
        )

    def test_to_artifact_is_self_describing_and_recursive(self) -> None:
        evaluation = self._build_evaluation(
            triggered=True, error=ConditionError(msg="evaluation failed")
        )

        assert evaluation.to_artifact() == {
            "triggered": True,
            "error": "evaluation failed",
            "evaluation_type": EvaluationType.WORKFLOW,
            "evaluation_phase": EvaluationPhase.INITIAL,
            "workflow_id": 10,
            "detector_id": self.detector.id,
            "detector_type": self.detector.type,
            "project_id": self.project.id,
            "event_id": self.event.event_id,
            "group_id": self.group.id,
            "outcome": WorkflowEvaluationOutcome.ERROR,
            "triggered_action_ids": [],
            "trigger_group_evaluation": {
                "triggered": True,
                "error": "evaluation failed",
                "logic_type": DataConditionGroup.Type.ANY,
                "result": True,
                "condition_evaluations": [],
            },
            "filter_group_evaluations": [],
        }

    def test_to_artifact_includes_deferred_conditions(self) -> None:
        evaluation = self._build_evaluation(deferred=True)

        artifact = evaluation.to_artifact()

        assert artifact["outcome"] == WorkflowEvaluationOutcome.DEFERRED
        assert artifact["deferred"] == {
            "trigger_group_id": 20,
            "filter_group_ids": [30],
            "passing_filter_group_ids": [40],
        }

    def test_deferred_outcome_takes_precedence_over_error(self) -> None:
        evaluation = self._build_evaluation(
            deferred=True,
            error=ConditionError(msg="fast condition failed"),
        )

        assert evaluation.outcome == WorkflowEvaluationOutcome.DEFERRED

    def test_action_filter_error_sets_error_outcome(self) -> None:
        filter_evaluation = DataConditionGroupEvaluation(
            result=False,
            triggered=False,
            error=ConditionError(msg="action filter failed"),
            data={
                "condition_evaluations": [],
                "logic_type": DataConditionGroup.Type.ANY,
            },
        )
        evaluation = self._build_evaluation(
            triggered=True,
            filter_group_evaluations=[filter_evaluation],
        )

        assert evaluation.outcome == WorkflowEvaluationOutcome.ERROR

    def test_condition_artifact_excludes_raw_input_data(self) -> None:
        condition = self.create_data_condition()
        evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data={"email": "user@example.com"},
        )

        artifact = evaluation.to_artifact()

        assert artifact == {
            "triggered": True,
            "error": None,
            "condition_id": condition.id,
            "condition_type": condition.type,
            "input_type": "dict",
            "input": None,
            "result": True,
        }
        assert "user@example.com" not in str(artifact)

    def test_condition_artifact_includes_string_input(self) -> None:
        condition = self.create_data_condition()
        evaluation = DataConditionEvaluation(
            condition=condition,
            result=True,
            triggered=True,
            data="production",
        )

        assert evaluation.to_artifact()["input"] == "production"

    def test_emitter_always_logs_with_feature_enabled(self) -> None:
        evaluation = self._build_evaluation()
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
            assert emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )

        mock_logger.info.assert_called_once()

    def test_should_log_targeted_workflow(self) -> None:
        evaluation = self._build_evaluation(workflow_id=10)
        with (
            Feature({"organizations:workflow-engine-log-evaluations": False}),
            override_options(
                {
                    "workflow_engine.evaluation_log_target_workflow_ids": [10],
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                }
            ),
        ):
            assert should_log(
                self.organization,
                self._build_batch_result({10: evaluation}),
            )

    def test_emitter_respects_sample_rate_when_feature_disabled(self) -> None:
        evaluation = self._build_evaluation()
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": False}),
            override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.1,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ),
            mock.patch(f"{LOGGING_MODULE}.random.random", side_effect=[0.05, 0.15]),
        ):
            assert emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )
            assert not emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )

        mock_logger.info.assert_called_once()

    def test_emitter_logs_artifact_to_sentry_logger(self) -> None:
        evaluation = self._build_evaluation(triggered=True)
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}),
            mock.patch(f"{LOGGING_MODULE}.sdk_logger") as mock_sentry_logger,
        ):
            assert emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result({10: evaluation}),
            )

        mock_sentry_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation",
            attributes={**evaluation.to_artifact(), "organization_id": self.organization.id},
        )
        mock_logger.info.assert_not_called()

    def test_emitter_logs_each_workflow_evaluation(self) -> None:
        evaluations = {
            10: self._build_evaluation(workflow_id=10),
            11: self._build_evaluation(workflow_id=11),
        }
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": False}),
        ):
            assert emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result(evaluations),
            )

        assert mock_logger.info.call_count == 2
        assert [
            call.kwargs["extra"]["workflow_id"] for call in mock_logger.info.call_args_list
        ] == [
            10,
            11,
        ]

    def test_emitter_logs_empty_batch_outcome(self) -> None:
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            assert emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                result=self._build_batch_result(
                    outcome=WorkflowEvaluationOutcome.NO_WORKFLOWS,
                ),
            )

        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation",
            extra={
                "evaluation_type": EvaluationType.WORKFLOW,
                "evaluation_phase": EvaluationPhase.INITIAL,
                "outcome": WorkflowEvaluationOutcome.NO_WORKFLOWS,
                "project_id": self.project.id,
                "group_id": self.group.id,
                "event_id": self.event.event_id,
                "detector_id": self.detector.id,
                "detector_type": self.detector.type,
                "error": None,
                "organization_id": self.organization.id,
            },
        )

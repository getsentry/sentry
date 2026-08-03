from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.processors.evaluation_logging import emit_workflow_evaluation_logs
from sentry.workflow_engine.processors.evaluations import (
    DataConditionEvaluation,
    DataConditionGroupEvaluation,
    WorkflowEvaluation,
)
from sentry.workflow_engine.types import ConditionError, WorkflowEventData

LOGGING_MODULE = "sentry.workflow_engine.processors.evaluation_logging"


class TestWorkflowEvaluationArtifact(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)
        self.event_data = WorkflowEventData(event=self.event, group=self.event.group)
        self.detector = self.create_detector(project=self.project)

    def _build_evaluation(
        self,
        *,
        triggered: bool = False,
        error: ConditionError | None = None,
        deferred: bool = False,
        workflow_id: int = 10,
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
            result="deferred" if deferred else [],
            triggered=triggered,
            error=error,
            data={
                "trigger_group_eval": trigger_evaluation,
                "filter_group_evals": [],
                "event": self.event_data,
                "deferred": (
                    {
                        "delayed_when_group_id": 20,
                        "delayed_if_group_ids": [30],
                        "passing_if_group_ids": [40],
                    }
                    if deferred
                    else None
                ),
            },
        )

    def test_to_artifact_is_self_describing_and_recursive(self) -> None:
        evaluation = self._build_evaluation(
            triggered=True, error=ConditionError(msg="evaluation failed")
        )

        assert evaluation.to_artifact() == {
            "triggered": True,
            "error": "evaluation failed",
            "workflow_id": 10,
            "detector_id": self.detector.id,
            "detector_type": self.detector.type,
            "event_id": self.event.event_id,
            "group_id": self.event.group.id,
            "result_type": "actions",
            "triggered_action_ids": [],
            "deferred": None,
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

        assert artifact["result_type"] == "deferred"
        assert artifact["deferred"] == {
            "delayed_when_group_id": 20,
            "delayed_if_group_ids": [30],
            "passing_if_group_ids": [40],
        }

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
                evaluations={10: evaluation},
            )

        mock_logger.info.assert_called_once()

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
                evaluations={10: evaluation},
            )
            assert not emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                evaluations={10: evaluation},
            )

        mock_logger.info.assert_called_once()

    def test_emitter_logs_artifact_to_sentry_logger(self) -> None:
        evaluation = self._build_evaluation(triggered=True)
        mock_logger = mock.MagicMock()
        with (
            Feature({"organizations:workflow-engine-log-evaluations": True}),
            override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}),
            mock.patch(f"{LOGGING_MODULE}.sentry_logger") as mock_sentry_logger,
        ):
            assert emit_workflow_evaluation_logs(
                mock_logger,
                organization=self.organization,
                evaluations={10: evaluation},
            )

        mock_sentry_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.evaluation.workflows.triggered",
            attributes=evaluation.to_artifact(),
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
                evaluations=evaluations,
            )

        assert mock_logger.info.call_count == 2
        assert [
            call.kwargs["extra"]["workflow_id"] for call in mock_logger.info.call_args_list
        ] == [
            10,
            11,
        ]

    def test_emitter_skips_empty_evaluations(self) -> None:
        mock_logger = mock.MagicMock()

        assert not emit_workflow_evaluation_logs(
            mock_logger,
            organization=self.organization,
            evaluations={},
        )
        mock_logger.info.assert_not_called()

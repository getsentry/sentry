from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.models import Action, DataConditionGroup
from sentry.workflow_engine.processors.evaluations import (
    DataConditionGroupEvaluation,
    WorkflowEvaluation,
)
from sentry.workflow_engine.processors.evaluations.workflow import GroupedWorkflowEvaluationResult
from sentry.workflow_engine.types import ConditionError, WorkflowEventData

LOG_TO_MODULE = "sentry.workflow_engine.processors.evaluations.workflow"


def _trigger_group() -> DataConditionGroupEvaluation:
    return DataConditionGroupEvaluation(
        result=True,
        triggered=True,
        error=None,
        data={"condition_evaluations": [], "logic_type": DataConditionGroup.Type.ANY},
    )


class TestGroupedWorkflowEvaluationResultLogTo(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)

    def _build_result(self) -> GroupedWorkflowEvaluationResult:
        return GroupedWorkflowEvaluationResult(
            result={},
            tainted=True,
            organization=self.organization,
            event=self.event,
        )

    def test_log_to_always_logs_with_feature_enabled(self) -> None:
        evaluation = self._build_result()

        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                assert evaluation.to_log(mock_logger) is True

    def test_log_to_respects_sample_rate_when_feature_disabled(self) -> None:
        evaluation = self._build_result()
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": False}):
            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                with mock.patch(f"{LOG_TO_MODULE}.random.random", return_value=0.5):
                    assert not evaluation.to_log(mock_logger)

            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 1.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                with mock.patch(f"{LOG_TO_MODULE}.random.random", return_value=0.5):
                    assert evaluation.to_log(mock_logger)

    def test_log_to_samples_correctly(self) -> None:
        evaluation = self._build_result()
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": False}):
            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.1,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                with mock.patch(f"{LOG_TO_MODULE}.random.random", return_value=0.05):
                    assert evaluation.to_log(mock_logger)

                with mock.patch(f"{LOG_TO_MODULE}.random.random", return_value=0.15):
                    assert not evaluation.to_log(mock_logger)

    def test_log_to_sentry_logger_when_direct_to_sentry_enabled(self) -> None:
        evaluation = self._build_result()
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            with override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}):
                with mock.patch(f"{LOG_TO_MODULE}.sentry_logger") as mock_sentry_logger:
                    assert evaluation.to_log(mock_logger)
                    mock_sentry_logger.info.assert_called_once()
                    mock_logger.info.assert_not_called()

    def test_log_to_regular_logger_when_direct_to_sentry_disabled(self) -> None:
        evaluation = self._build_result()
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            with override_options({"workflow_engine.evaluation_logs_direct_to_sentry": False}):
                with mock.patch(f"{LOG_TO_MODULE}.sentry_logger") as mock_sentry_logger:
                    assert evaluation.to_log(mock_logger)
                    mock_logger.info.assert_called_once()
                    mock_sentry_logger.info.assert_not_called()


class TestWorkflowEvaluationArtifact(TestCase):
    def test_actions_result_lists_action_ids(self) -> None:
        trigger_group = _trigger_group()
        filter_group = _trigger_group()
        # Unsaved Action instances: to_artifact only reads `id`, no DB access.
        evaluation = WorkflowEvaluation(
            result=[Action(id=7), Action(id=9)],
            triggered=True,
            error=None,
            data={
                "trigger_group_eval": trigger_group,
                "filter_group_evals": [filter_group],
                "event": WorkflowEventData(event=mock.MagicMock(), group=mock.MagicMock()),
            },
        )
        assert evaluation.to_artifact() == {
            "triggered": True,
            "error": None,
            "result": "actions",
            "triggered_action_ids": [7, 9],
            "trigger_group_eval": trigger_group.to_artifact(),
            "filter_group_evals": [filter_group.to_artifact()],
        }

    def test_deferred_result_has_no_action_ids(self) -> None:
        trigger_group = _trigger_group()
        evaluation = WorkflowEvaluation(
            result="deferred",
            triggered=True,
            error=ConditionError(msg="boom"),
            data={
                "trigger_group_eval": trigger_group,
                "filter_group_evals": [],
                "event": WorkflowEventData(event=mock.MagicMock(), group=mock.MagicMock()),
            },
        )
        artifact = evaluation.to_artifact()
        assert artifact["result"] == "deferred"
        assert artifact["triggered_action_ids"] is None
        assert artifact["error"] == "boom"
        assert artifact["filter_group_evals"] == []


class TestGroupedWorkflowEvaluationResultArtifact(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)

    def test_embeds_per_workflow_artifacts_keyed_by_id(self) -> None:
        trigger_group = _trigger_group()
        workflow_eval = WorkflowEvaluation(
            result="deferred",
            triggered=True,
            error=None,
            data={
                "trigger_group_eval": trigger_group,
                "filter_group_evals": [],
                "event": WorkflowEventData(event=mock.MagicMock(), group=mock.MagicMock()),
            },
        )
        result = GroupedWorkflowEvaluationResult(
            result={123: workflow_eval},
            tainted=True,
            organization=self.organization,
            event=self.event,
        )
        artifact = result.to_artifact()
        assert artifact["workflow_evaluations"] == {"123": workflow_eval.to_artifact()}

    def test_empty_result_yields_empty_workflow_evaluations(self) -> None:
        result = GroupedWorkflowEvaluationResult(
            result={},
            tainted=True,
            organization=self.organization,
            event=self.event,
        )
        assert result.to_artifact()["workflow_evaluations"] == {}

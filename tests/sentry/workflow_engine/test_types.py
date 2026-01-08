from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.types import WorkflowEvaluation, WorkflowEvaluationData


class TestWorkflowEvaluationLogTo(TestCase):

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)

        self.evaluation_data = WorkflowEvaluationData(
            event=self.event,
            organization=self.organization,
        )

    def test_log_to_always_logs_with_feature_enabled(self) -> None:
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)

        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                assert evaluation.log_to(mock_logger) is True

    def test_log_to_respects_sample_rate_when_feature_disabled(self) -> None:
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": False}):
            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.5):
                    assert not evaluation.log_to(mock_logger)

            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 1.0,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.5):
                    assert evaluation.log_to(mock_logger)

    def test_log_to_samples_correctly(self) -> None:
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": False}):
            with override_options(
                {
                    "workflow_engine.evaluation_log_sample_rate": 0.1,
                    "workflow_engine.evaluation_logs_direct_to_sentry": False,
                }
            ):
                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.05):
                    assert evaluation.log_to(mock_logger)

                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.15):
                    assert not evaluation.log_to(mock_logger)

    def test_log_to_sentry_logger_when_direct_to_sentry_enabled(self) -> None:
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            with override_options({"workflow_engine.evaluation_logs_direct_to_sentry": True}):
                with mock.patch("sentry.workflow_engine.types.sentry_logger") as mock_sentry_logger:
                    assert evaluation.log_to(mock_logger)
                    mock_sentry_logger.info.assert_called_once()
                    mock_logger.info.assert_not_called()

    def test_log_to_regular_logger_when_direct_to_sentry_disabled(self) -> None:
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            with override_options({"workflow_engine.evaluation_logs_direct_to_sentry": False}):
                with mock.patch("sentry.workflow_engine.types.sentry_logger") as mock_sentry_logger:
                    assert evaluation.log_to(mock_logger)
                    mock_logger.info.assert_called_once()
                    mock_sentry_logger.info.assert_not_called()

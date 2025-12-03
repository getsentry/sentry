from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.helpers.options import override_options
from sentry.workflow_engine.types import WorkflowEvaluation, WorkflowEvaluationData


class TestWorkflowEvaluationLogTo(TestCase):

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.event = self.store_event(data={}, project_id=self.project.id)

        self.evaluation_data = WorkflowEvaluationData(
            event=self.event,
            organization=self.organization,
        )

    def test_log_to_always_logs_with_feature_enabled(self):
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)

        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": True}):
            with override_options({"workflow_engine.evaluation_log_sample_rate": 0.0}):
                assert evaluation.log_to(mock_logger) is True

    def test_log_to_respects_sample_rate_when_feature_disabled(self):
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": False}):
            with override_options({"workflow_engine.evaluation_log_sample_rate": 0.0}):
                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.5):
                    assert not evaluation.log_to(mock_logger), "Should not log with 0% sample rate"

            with override_options({"workflow_engine.evaluation_log_sample_rate": 1.0}):
                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.5):
                    assert evaluation.log_to(mock_logger), "Should log with 100% sample rate"

    def test_log_to_samples_correctly(self):
        evaluation = WorkflowEvaluation(tainted=True, data=self.evaluation_data)
        mock_logger = mock.MagicMock()

        with Feature({"organizations:workflow-engine-log-evaluations": False}):
            with override_options({"workflow_engine.evaluation_log_sample_rate": 0.1}):
                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.05):
                    assert evaluation.log_to(mock_logger), "Should log when random < sample_rate"

                with mock.patch("sentry.workflow_engine.types.random.random", return_value=0.15):
                    assert not evaluation.log_to(
                        mock_logger
                    ), "Should not log when random >= sample_rate"

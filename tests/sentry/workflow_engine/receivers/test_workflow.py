from unittest.mock import MagicMock, patch

from sentry.testutils.cases import TestCase


class WorkflowReceiverTests(TestCase):
    def setUp(self) -> None:
        self.environment = self.create_environment()
        self.workflow = self.create_workflow(environment=self.environment)
        self.detector = self.create_detector()
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__new_workflow(self, mock_invalidate: MagicMock) -> None:
        new_workflow = self.create_workflow()

        # since this is a new workflow, nothing to invalidate
        mock_invalidate.assert_not_called()
        assert new_workflow

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__update_workflow(self, mock_invalidate: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.enabled = False
            self.workflow.save()

        mock_invalidate.assert_called_with(self.detector.id, self.workflow.environment_id)
        assert self.workflow.enabled is False

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__delete_workflow(self, mock_invalidate: MagicMock) -> None:
        env_id = self.workflow.environment_id
        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.delete()
        mock_invalidate.assert_called_with(self.detector.id, env_id)

    @patch("sentry.workflow_engine.receivers.workflow.invalidate_processing_workflows")
    def test_cache_invalidate__delete_with_many_detectors(self, mock_invalidate: MagicMock) -> None:
        detector = self.create_detector()
        self.create_detector_workflow(detector=detector, workflow=self.workflow)
        env_id = self.workflow.environment_id

        with self.capture_on_commit_callbacks(execute=True):
            self.workflow.delete()

        # Make sure it was called for each detector
        assert mock_invalidate.call_count == 2
        mock_invalidate.assert_any_call(self.detector.id, env_id)
        mock_invalidate.assert_any_call(detector.id, env_id)

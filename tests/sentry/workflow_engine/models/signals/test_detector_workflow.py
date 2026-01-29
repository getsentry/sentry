from unittest.mock import MagicMock, patch

from sentry.testutils.cases import TestCase


class DetectorWorkflowSignalsTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.environment = self.create_environment()
        self.workflow = self.create_workflow(environment=self.environment)
        self.detector = self.create_detector()
        self.dw = self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

    @patch(
        "sentry.workflow_engine.models.signals.detector_workflow.invalidate_processing_workflows"
    )
    def test_cache_invalidate__on_create(self, mock_invalidate: MagicMock) -> None:
        detector = self.create_detector()
        workflow = self.create_workflow()

        self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        mock_invalidate.assert_called_once_with(detector.id, None)

    @patch(
        "sentry.workflow_engine.models.signals.detector_workflow.invalidate_processing_workflows"
    )
    def test_cache_invalidate__on_update__detector(self, mock_invalidate: MagicMock) -> None:
        detector = self.create_detector()
        self.dw.detector = detector
        self.dw.save()

        # On update, we need to invalidate the old / new connection, this is not a common scenario
        mock_invalidate.assert_any_call(self.detector.id, self.environment.id)
        mock_invalidate.assert_any_call(detector.id, self.environment.id)

    @patch(
        "sentry.workflow_engine.models.signals.detector_workflow.invalidate_processing_workflows"
    )
    def test_cache_invalidate__on_update__workflow(self, mock_invalidate: MagicMock) -> None:
        workflow = self.create_workflow()
        self.dw.workflow = workflow
        self.dw.save()

        # On update, we need to invalidate the old / new connection, this is not a common scenario
        mock_invalidate.assert_any_call(self.detector.id, self.environment.id)
        mock_invalidate.assert_any_call(self.detector.id, None)

    @patch(
        "sentry.workflow_engine.models.signals.detector_workflow.invalidate_processing_workflows"
    )
    def test_cache_invalidate__on_delete(self, mock_invalidate: MagicMock) -> None:
        self.dw.delete()
        mock_invalidate.assert_called_once_with(self.detector.id, self.environment.id)

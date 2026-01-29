from unittest.mock import MagicMock, patch

import pytest
from jsonschema import ValidationError

from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.detector import Detector


class DetectorSignalsTests(TestCase):
    def setUp(self) -> None:
        self.detector = self.create_detector()
        self.workflow = self.create_workflow()
        self.dw = self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

    @patch("sentry.workflow_engine.models.signals.detector.invalidate_processing_workflows")
    def test_cache_invalidate__create_detector(self, mock_invalidate: MagicMock) -> None:
        detector = Detector.objects.create(
            project=self.project, type=ErrorGroupType.slug, config={}
        )

        # new detectors have nothing to invalidate
        mock_invalidate.assert_not_called()
        assert detector

    @patch("sentry.workflow_engine.models.signals.detector.invalidate_processing_workflows")
    def test_cache_invalidate__modify_detector(self, mock_invalidate: MagicMock) -> None:
        self.detector.enabled = False
        self.detector.save()

        # Ensure the modified detector clears the workflow cache
        mock_invalidate.assert_called_with(self.detector.id, None)

    def test_enforce_config__raises_errors(self) -> None:
        with pytest.raises(ValidationError):
            # Creates a metric issue detector, w/o the correct config
            Detector.objects.create(type="metric_issue")

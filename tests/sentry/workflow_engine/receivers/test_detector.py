import pytest
from jsonschema import ValidationError

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.detector import Detector


class DetectorSignalsTests(TestCase):
    def test_enforce_config__raises_errors(self) -> None:
        with pytest.raises(ValidationError):
            # Creates a metric issue detector, w/o the correct config
            Detector.objects.create(type="metric_issue")

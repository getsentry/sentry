from typing import int
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.detector_state import DetectorState
from sentry.workflow_engine.types import DetectorPriorityLevel


class DetectorStateTest(TestCase):
    def test_priority_level_property(self) -> None:
        """Test that priority_level property correctly converts state string to enum"""
        detector = self.create_detector()

        # Create detector state with OK priority
        detector_state = self.create_detector_state(
            detector=detector,
            state=DetectorPriorityLevel.OK,
        )
        assert detector_state.priority_level == DetectorPriorityLevel.OK

        # Update to HIGH priority
        detector_state.update(state=DetectorPriorityLevel.HIGH)
        detector_state = DetectorState.objects.get(id=detector_state.id)
        assert detector_state.priority_level == DetectorPriorityLevel.HIGH

        # Update to MEDIUM priority
        detector_state.update(state=DetectorPriorityLevel.MEDIUM)
        detector_state = DetectorState.objects.get(id=detector_state.id)
        assert detector_state.priority_level == DetectorPriorityLevel.MEDIUM

        # Update to LOW priority
        detector_state.update(state=DetectorPriorityLevel.LOW)
        detector_state = DetectorState.objects.get(id=detector_state.id)
        assert detector_state.priority_level == DetectorPriorityLevel.LOW

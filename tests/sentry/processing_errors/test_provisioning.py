from unittest.mock import patch

from sentry.processing_errors.grouptype import SourcemapCheckStatus, SourcemapConfigurationType
from sentry.processing_errors.provisioning import ensure_sourcemap_detector
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataConditionGroup, Detector, DetectorState
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestEnsureSourcemapDetector(TestCase):
    def test_creates_detector_with_conditions(self) -> None:
        detector = ensure_sourcemap_detector(self.project)

        assert detector.type == SourcemapConfigurationType.slug
        assert detector.project == self.project

        condition_group = detector.workflow_condition_group
        assert condition_group is not None
        assert condition_group.logic_type == DataConditionGroup.Type.ANY

        conditions = list(
            DataCondition.objects.filter(condition_group=condition_group).order_by("comparison")
        )
        assert len(conditions) == 2

        success_condition = conditions[0]
        assert success_condition.comparison == SourcemapCheckStatus.SUCCESS
        assert success_condition.type == Condition.EQUAL
        assert success_condition.condition_result == DetectorPriorityLevel.OK

        failure_condition = conditions[1]
        assert failure_condition.comparison == SourcemapCheckStatus.FAILURE
        assert failure_condition.type == Condition.EQUAL
        assert failure_condition.condition_result == DetectorPriorityLevel.HIGH

        state = DetectorState.objects.get(detector=detector)
        assert state.is_triggered is False
        assert state.state == str(DetectorPriorityLevel.OK)

    def test_returns_existing_detector(self) -> None:
        first = ensure_sourcemap_detector(self.project)
        second = ensure_sourcemap_detector(self.project)

        assert first.id == second.id
        assert (
            Detector.objects.filter(
                type=SourcemapConfigurationType.slug, project=self.project
            ).count()
            == 1
        )

    def test_uses_cache_on_second_call(self) -> None:
        ensure_sourcemap_detector(self.project)

        with patch.object(Detector.objects, "get", wraps=Detector.objects.get) as mock_get:
            ensure_sourcemap_detector(self.project)
            mock_get.assert_not_called()

    def test_separate_detectors_per_project(self) -> None:
        other_project = self.create_project()

        detector_a = ensure_sourcemap_detector(self.project)
        detector_b = ensure_sourcemap_detector(other_project)

        assert detector_a.id != detector_b.id
        assert detector_a.project == self.project
        assert detector_b.project == other_project

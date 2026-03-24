from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.processing_errors.detection import _redis_key_triggered
from sentry.processing_errors.grouptype import SourcemapCheckStatus, SourcemapConfigurationType
from sentry.processing_errors.tasks import (
    STALENESS_THRESHOLD_MINUTES,
    resolve_stale_sourcemap_detectors,
)
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.handlers.detector.stateful import get_redis_client
from sentry.workflow_engine.models import DataConditionGroup, Detector, DetectorState
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestResolveStaleSourcemapDetectors(TestCase):
    def _create_triggered_detector(self, date_updated=None):
        """Create a detector with a triggered DetectorState."""
        condition_group = DataConditionGroup.objects.create(
            logic_type=DataConditionGroup.Type.ANY,
            organization_id=self.project.organization_id,
        )

        DataCondition.objects.create(
            comparison=SourcemapCheckStatus.FAILURE,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=condition_group,
        )

        DataCondition.objects.create(
            comparison=SourcemapCheckStatus.SUCCESS,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=condition_group,
        )

        detector = Detector.objects.create(
            type=SourcemapConfigurationType.slug,
            project=self.project,
            name="Sourcemap Configuration",
            config={},
            workflow_condition_group=condition_group,
        )

        state = DetectorState.objects.create(
            detector=detector,
            detector_group_key=None,
            is_triggered=True,
            state=DetectorPriorityLevel.HIGH,
        )

        if date_updated is not None:
            DetectorState.objects.filter(id=state.id).update(date_updated=date_updated)
            state.refresh_from_db()

        get_redis_client().set(_redis_key_triggered(self.project.id), "1", ex=3600)

        return detector, state

    @patch("sentry.processing_errors.tasks.produce_occurrence_to_kafka")
    def test_resolves_stale_detector(self, mock_produce) -> None:
        stale_time = timezone.now() - timedelta(minutes=STALENESS_THRESHOLD_MINUTES + 5)
        detector, state = self._create_triggered_detector(date_updated=stale_time)
        resolve_stale_sourcemap_detectors()
        state.refresh_from_db()
        assert state.is_triggered is False
        assert state.state == str(DetectorPriorityLevel.OK)
        assert get_redis_client().get(_redis_key_triggered(self.project.id)) is None
        mock_produce.assert_called_once()
        call_kwargs = mock_produce.call_args[1]
        assert call_kwargs["status_change"].project_id == self.project.id
        assert call_kwargs["status_change"].fingerprint == [
            f"{self.project.id}:sourcemap",
            f"detector:{detector.id}",
        ]

    @patch("sentry.processing_errors.tasks.produce_occurrence_to_kafka")
    def test_skips_recently_updated(self, mock_produce) -> None:
        _detector, state = self._create_triggered_detector()
        resolve_stale_sourcemap_detectors()
        state.refresh_from_db()
        assert state.is_triggered is True
        mock_produce.assert_not_called()

    @patch("sentry.processing_errors.tasks.produce_occurrence_to_kafka")
    def test_skips_already_resolved(self, mock_produce) -> None:
        stale_time = timezone.now() - timedelta(minutes=STALENESS_THRESHOLD_MINUTES + 5)
        _detector, state = self._create_triggered_detector(date_updated=stale_time)

        DetectorState.objects.filter(id=state.id).update(
            is_triggered=False,
            state=DetectorPriorityLevel.OK,
        )

        resolve_stale_sourcemap_detectors()
        mock_produce.assert_not_called()

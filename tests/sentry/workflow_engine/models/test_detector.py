from unittest.mock import patch

import pytest

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DetectorTest(BaseWorkflowTest):
    def setUp(self) -> None:
        self.detector = self.create_detector()

    def test_queryset(self) -> None:
        """
        Test that we filter out objects with statuses other than 'active'
        """
        assert Detector.objects.filter(id=self.detector.id).exists()
        self.detector.status = ObjectStatus.PENDING_DELETION
        self.detector.save()
        assert not Detector.objects.filter(id=self.detector.id).exists()

        self.detector.status = ObjectStatus.DELETION_IN_PROGRESS
        self.detector.save()
        assert not Detector.objects.filter(id=self.detector.id).exists()

    def test_get_conditions__cached(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .prefetch_related("workflow_condition_group__conditions")
            .first()
        )

        assert fetched_detector is not None
        with self.assertNumQueries(0):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_conditions__cached_group_only(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()
        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .first()
        )

        assert fetched_detector is not None
        with self.assertNumQueries(1):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_conditions__not_cached(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = Detector.objects.get(id=self.detector.id)
        with self.assertNumQueries(1):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_error_detector_for_project__success(self) -> None:
        """Test successful retrieval of error detector for project, created by default on project creation"""
        error_detector = self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        )
        result = Detector.get_error_detector_for_project(self.project.id)

        assert result == error_detector
        assert result.type == ErrorGroupType.slug
        assert result.project_id == self.project.id

    def test_get_error_detector_for_project__not_found(self) -> None:
        with pytest.raises(Detector.DoesNotExist):
            Detector.get_error_detector_for_project(self.project.id)

    def test_get_error_detector_for_project__wrong_type(self) -> None:
        self.create_detector(
            project=self.project,
            type=MetricIssue.slug,  # Use a different registered type
            name="Other Detector",
        )

        with pytest.raises(Detector.DoesNotExist):
            Detector.get_error_detector_for_project(self.project.id)

    def test_get_error_detector_for_project__caching(self) -> None:
        error_detector = self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        )

        # First call - cache miss
        with (
            patch("sentry.utils.cache.cache.get") as mock_cache_get,
            patch("sentry.utils.cache.cache.set") as mock_cache_set,
        ):
            mock_cache_get.return_value = None

            result = Detector.get_error_detector_for_project(self.project.id)

            assert result == error_detector

            # Verify cache key format using the new method
            expected_cache_key = Detector._get_detector_project_type_cache_key(
                self.project.id, ErrorGroupType.slug
            )
            mock_cache_get.assert_called_once_with(expected_cache_key)
            mock_cache_set.assert_called_once_with(
                expected_cache_key, error_detector, Detector.CACHE_TTL
            )

    def test_get_error_detector_for_project__cache_hit(self) -> None:
        error_detector = self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        )

        # Mock cache hit
        with patch("sentry.utils.cache.cache.get") as mock_cache_get:
            mock_cache_get.return_value = error_detector

            result = Detector.get_error_detector_for_project(self.project.id)

            assert result == error_detector

            # Verify cache was checked with correct key
            expected_cache_key = Detector._get_detector_project_type_cache_key(
                self.project.id, ErrorGroupType.slug
            )
            mock_cache_get.assert_called_once_with(expected_cache_key)

    def test_settings(self) -> None:
        detector = self.create_detector()
        assert detector.settings

    def test_settings__no_settings__invaild_settings(self) -> None:
        # This is an issue type w/o a detector association
        detector = self.create_detector(
            type="profile_json_decode_main_thread", name="Invalid Detector"
        )

        with pytest.raises(ValueError, match="Registered grouptype has no detector settings"):
            assert detector.settings


def test_get_detector_project_type_cache_key() -> None:
    project_id = 123
    detector_type = "error"

    cache_key = Detector._get_detector_project_type_cache_key(project_id, detector_type)

    assert cache_key == f"detector:by_proj_type:{project_id}:{detector_type}"


def test_get_detectors_by_data_source_cache_key() -> None:
    source_id = "12345"
    source_type = "test"

    cache_key = Detector._get_detectors_by_data_source_cache_key(source_id, source_type)

    assert cache_key == f"detector:detectors_by_data_source:{source_type}:{source_id}"


class TestGetDetectorsByDataSource(BaseWorkflowTest):
    def test_get_detectors_by_data_source__single_detector(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector])

        with self.assertNumQueries(1):
            result = Detector.get_detectors_by_data_source("12345", "test")

            assert len(result) == 1
            assert result[0].id == detector.id

    def test_get_detectors_by_data_source__multiple_detectors(self) -> None:
        detector1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug
        )
        detector3 = self.create_detector(
            project=self.project, name="Detector 3", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector1, detector2, detector3])

        result = Detector.get_detectors_by_data_source("12345", "test")

        assert len(result) == 3
        assert {d.id for d in result} == {detector1.id, detector2.id, detector3.id}

    def test_get_detectors_by_data_source__not_found(self) -> None:
        result = Detector.get_detectors_by_data_source("nonexistent", "test")
        assert result == []

    def test_get_detectors_by_data_source__filters_disabled(self) -> None:
        detector1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug, enabled=False
        )
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector1, detector2])

        result = Detector.get_detectors_by_data_source("12345", "test")

        assert len(result) == 1
        assert result[0].id == detector1.id

    def test_get_detectors_by_data_source__cache_miss(self) -> None:
        detector1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector1, detector2])

        with (
            patch("sentry.utils.cache.cache.get") as mock_cache_get,
            patch("sentry.utils.cache.cache.set") as mock_cache_set,
        ):
            mock_cache_get.return_value = None

            result = Detector.get_detectors_by_data_source("12345", "test")

            assert len(result) == 2
            assert {d.id for d in result} == {detector1.id, detector2.id}

            expected_cache_key = Detector._get_detectors_by_data_source_cache_key("12345", "test")
            mock_cache_get.assert_called_once_with(expected_cache_key)
            mock_cache_set.assert_called_once()
            call_args = mock_cache_set.call_args
            assert call_args[0][0] == expected_cache_key
            cached_detectors = call_args[0][1]
            assert len(cached_detectors) == 2
            assert {d.id for d in cached_detectors} == {detector1.id, detector2.id}
            assert call_args[0][2] == Detector.CACHE_TTL

    def test_get_detectors_by_data_source__cache_hit(self) -> None:
        detector1 = self.create_detector(project=self.project, name="Detector 1")
        detector2 = self.create_detector(project=self.project, name="Detector 2")
        cached_detectors = [detector1, detector2]

        with patch("sentry.utils.cache.cache.get") as mock_cache_get:
            mock_cache_get.return_value = cached_detectors

            result = Detector.get_detectors_by_data_source("12345", "test")

            assert result == cached_detectors

            expected_cache_key = Detector._get_detectors_by_data_source_cache_key("12345", "test")
            mock_cache_get.assert_called_once_with(expected_cache_key)

    def test_get_detectors_by_data_source__eager_loading_cached(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")
        detector.workflow_condition_group = self.create_data_condition_group()
        detector.save()
        self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            type="eq",
            comparison="HIGH",
            condition_result=1,
        )
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector])

        result = Detector.get_detectors_by_data_source("12345", "test")
        assert len(result) == 1

        with self.assertNumQueries(0):
            cached_result = Detector.get_detectors_by_data_source("12345", "test")
            assert len(cached_result) == 1
            assert cached_result[0].workflow_condition_group is not None
            assert list(cached_result[0].workflow_condition_group.conditions.all())

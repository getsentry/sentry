from unittest.mock import patch

import pytest

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
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
        )  # this creates / fetches the single default error detector for the project
        result = Detector.get_error_detector_for_project(self.project.id)

        assert result == error_detector
        assert result.type == ErrorGroupType.slug
        assert result.project_id == self.project.id

    def test_get_error_detector_for_project__not_found(self) -> None:
        self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        ).delete()  # delete the single default error detector for the project
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

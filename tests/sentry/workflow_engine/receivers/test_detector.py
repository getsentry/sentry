from unittest.mock import MagicMock, patch

import pytest
from jsonschema import ValidationError

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.processors.data_source import bulk_fetch_enabled_detectors
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DetectorSignalValidationTests(TestCase):
    def test_enforce_config__raises_errors(self) -> None:
        with pytest.raises(ValidationError):
            # Creates a metric issue detector, w/o the correct config
            Detector.objects.create(type="metric_issue")


class DetectorSignalCacheInvalidationTests(TestCase):
    def setUp(self) -> None:
        self.detector = self.create_detector()
        self.workflow = self.create_workflow()
        self.dw = self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

    @patch("sentry.workflow_engine.receivers.detector.invalidate_processing_workflows")
    def test_cache_invalidate__create_detector(self, mock_invalidate: MagicMock) -> None:
        detector = Detector.objects.create(
            project=self.project, type=ErrorGroupType.slug, config={}
        )

        # new detectors have nothing to invalidate
        mock_invalidate.assert_not_called()
        assert detector

    @patch("sentry.workflow_engine.receivers.detector.invalidate_processing_workflows")
    def test_cache_invalidate__modify_detector(self, mock_invalidate: MagicMock) -> None:
        self.detector.enabled = False
        self.detector.save()

        # Ensure the modified detector clears the workflow cache
        mock_invalidate.assert_called_with(self.detector.id)


class TestDetectorCacheInvalidationSignals(BaseWorkflowTest):
    @with_feature("organizations:cache-detectors-by-data-source")
    def test_cache_invalidated_on_detector_save(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="signal_test_1", type="test")
        data_source.detectors.set([detector])

        bulk_fetch_enabled_detectors("signal_test_1", "test")

        with self.assertNumQueries(1):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("signal_test_1", "test")
            assert result[0].name == "Test Detector"

        detector.name = "Updated Detector Name"
        detector.save()

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("signal_test_1", "test")
            assert result[0].name == "Updated Detector Name"

    @with_feature("organizations:cache-detectors-by-data-source")
    def test_cache_invalidated_on_detector_enabled_change(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="signal_test_2", type="test")
        data_source.detectors.set([detector])

        bulk_fetch_enabled_detectors("signal_test_2", "test")

        with self.assertNumQueries(1):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("signal_test_2", "test")
            assert len(result) == 1

        detector.enabled = False
        detector.save()

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("signal_test_2", "test")
            assert len(result) == 0

    @with_feature("organizations:cache-detectors-by-data-source")
    def test_cache_invalidated_on_detector_delete(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="signal_test_3", type="test")
        data_source.detectors.set([detector])

        bulk_fetch_enabled_detectors("signal_test_3", "test")

        with self.assertNumQueries(1):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("signal_test_3", "test")
            assert len(result) == 1

        detector.delete()

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("signal_test_3", "test")
            assert len(result) == 0

    @with_feature("organizations:cache-detectors-by-data-source")
    def test_cache_invalidated_for_multiple_data_sources(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source_1 = self.create_data_source(source_id="signal_test_4a", type="test")
        data_source_2 = self.create_data_source(source_id="signal_test_4b", type="test")
        data_source_1.detectors.set([detector])
        data_source_2.detectors.set([detector])

        bulk_fetch_enabled_detectors("signal_test_4a", "test")
        bulk_fetch_enabled_detectors("signal_test_4b", "test")

        with self.assertNumQueries(2):
            # 1. Get data source 4a with organization (for feature flag check)
            # 2. Get data source 4b with organization (for feature flag check)
            result_1 = bulk_fetch_enabled_detectors("signal_test_4a", "test")
            result_2 = bulk_fetch_enabled_detectors("signal_test_4b", "test")
            assert result_1[0].name == "Test Detector"
            assert result_2[0].name == "Test Detector"

        detector.name = "Updated Name"
        detector.save()

        with self.assertNumQueries(4):
            # 1. Get data source 4a with organization (select_related)
            # 2. Get detectors for 4a (cache miss after invalidation)
            # 3. Get data source 4b with organization (select_related)
            # 4. Get detectors for 4b (cache miss after invalidation)
            result_1 = bulk_fetch_enabled_detectors("signal_test_4a", "test")
            result_2 = bulk_fetch_enabled_detectors("signal_test_4b", "test")
            assert result_1[0].name == "Updated Name"
            assert result_2[0].name == "Updated Name"

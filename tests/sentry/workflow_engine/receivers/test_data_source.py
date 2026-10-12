from sentry.incidents.grouptype import MetricIssue
from sentry.workflow_engine.caches.data_source import (
    get_data_sources_by_detector_and_source_id,
)
from sentry.workflow_engine.processors.data_source import bulk_fetch_enabled_detectors
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestDataSourceCacheInvalidationSignals(BaseWorkflowTest):
    def test_cache_invalidated_on_data_source_save(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="ds_signal_test_1", type="test")
        data_source.detectors.set([detector])

        bulk_fetch_enabled_detectors("ds_signal_test_1", "test")

        # 1. Get data source with organization (for feature flag check)
        result = bulk_fetch_enabled_detectors("ds_signal_test_1", "test")
        assert len(result) == 1

        # Update the data source (not a create)
        data_source.save()

        with self.assertNumQueries(1):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("ds_signal_test_1", "test")
            assert len(result) == 1


class TestDataSourcesByDetectorCacheInvalidationSignals(BaseWorkflowTest):
    def test_cache_invalidated_on_data_source_save(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="ds_evidence_test_1", type="test")
        data_source.detectors.set([detector])

        get_data_sources_by_detector_and_source_id(detector.id, "ds_evidence_test_1")

        with self.assertNumQueries(0):
            result = get_data_sources_by_detector_and_source_id(detector.id, "ds_evidence_test_1")
            assert len(result) == 1

        # Update the data source (not a create)
        data_source.save()

        with self.assertNumQueries(1):
            result = get_data_sources_by_detector_and_source_id(detector.id, "ds_evidence_test_1")
            assert len(result) == 1
            assert result[0].id == data_source.id

    def test_cache_invalidated_on_data_source_delete(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="ds_evidence_test_2", type="test")
        data_source.detectors.set([detector])

        get_data_sources_by_detector_and_source_id(detector.id, "ds_evidence_test_2")

        with self.assertNumQueries(0):
            result = get_data_sources_by_detector_and_source_id(detector.id, "ds_evidence_test_2")
            assert len(result) == 1

        data_source.delete()

        with self.assertNumQueries(1):
            assert (
                get_data_sources_by_detector_and_source_id(detector.id, "ds_evidence_test_2") == []
            )

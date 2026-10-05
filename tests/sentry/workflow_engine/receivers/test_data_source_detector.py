from sentry.incidents.grouptype import MetricIssue
from sentry.workflow_engine.caches.data_source import (
    get_data_sources_by_detector_and_source_id,
)
from sentry.workflow_engine.models import DataSourceDetector
from sentry.workflow_engine.processors.data_source import bulk_fetch_enabled_detectors
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestDataSourceDetectorCacheInvalidationSignals(BaseWorkflowTest):
    def test_cache_invalidated_on_data_source_detector_create(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_signal_test_1", type="test")

        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        bulk_fetch_enabled_detectors("dsd_signal_test_1", "test")

        with self.assertNumQueries(0):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_1", "test")
            assert len(result) == 1
            assert result[0].id == detector.id

        detector2 = self.create_detector(
            project=self.project, name="Test Detector 2", type=MetricIssue.slug
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector2)

        with self.assertNumQueries(1):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_1", "test")
            assert len(result) == 2
            assert {d.id for d in result} == {detector.id, detector2.id}

    def test_cache_invalidated_on_data_source_detector_delete(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_signal_test_2", type="test")
        data_source.detectors.set([detector])

        bulk_fetch_enabled_detectors("dsd_signal_test_2", "test")

        with self.assertNumQueries(0):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_2", "test")
            assert len(result) == 1

        DataSourceDetector.objects.filter(data_source=data_source, detector=detector).delete()

        with self.assertNumQueries(1):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_2", "test")
            assert len(result) == 0

    def test_cache_invalidated_on_data_source_detectors_set(self) -> None:
        detector1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_signal_test_3", type="test")
        data_source.detectors.set([detector1])

        bulk_fetch_enabled_detectors("dsd_signal_test_3", "test")

        with self.assertNumQueries(0):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_3", "test")
            assert len(result) == 1
            assert result[0].id == detector1.id

        data_source.detectors.set([detector2])

        with self.assertNumQueries(1):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_3", "test")
            assert len(result) == 1
            assert result[0].id == detector2.id


class TestDataSourcesByDetectorCacheInvalidationSignals(BaseWorkflowTest):
    def test_cache_invalidated_on_data_source_detector_create(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_evidence_test_1", type="test")

        get_data_sources_by_detector_and_source_id(detector.id, "dsd_evidence_test_1")

        with self.assertNumQueries(0):
            assert (
                get_data_sources_by_detector_and_source_id(detector.id, "dsd_evidence_test_1") == []
            )

        self.create_data_source_detector(data_source=data_source, detector=detector)

        with self.assertNumQueries(1):
            result = get_data_sources_by_detector_and_source_id(detector.id, "dsd_evidence_test_1")
            assert len(result) == 1
            assert result[0].id == data_source.id

    def test_cache_invalidated_on_data_source_detector_delete(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_evidence_test_2", type="test")
        data_source.detectors.set([detector])

        get_data_sources_by_detector_and_source_id(detector.id, "dsd_evidence_test_2")

        with self.assertNumQueries(0):
            result = get_data_sources_by_detector_and_source_id(detector.id, "dsd_evidence_test_2")
            assert len(result) == 1

        DataSourceDetector.objects.filter(data_source=data_source, detector=detector).delete()

        with self.assertNumQueries(1):
            assert (
                get_data_sources_by_detector_and_source_id(detector.id, "dsd_evidence_test_2") == []
            )

    def test_cache_invalidated_on_data_source_detectors_set(self) -> None:
        detector1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_evidence_test_3", type="test")
        data_source.detectors.set([detector1])

        get_data_sources_by_detector_and_source_id(detector1.id, "dsd_evidence_test_3")

        with self.assertNumQueries(0):
            result = get_data_sources_by_detector_and_source_id(detector1.id, "dsd_evidence_test_3")
            assert len(result) == 1

        data_source.detectors.set([detector2])

        with self.assertNumQueries(1):
            assert (
                get_data_sources_by_detector_and_source_id(detector1.id, "dsd_evidence_test_3")
                == []
            )

        with self.assertNumQueries(1):
            result = get_data_sources_by_detector_and_source_id(detector2.id, "dsd_evidence_test_3")
            assert len(result) == 1
            assert result[0].id == data_source.id

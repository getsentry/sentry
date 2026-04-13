from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models import DataSourceDetector
from sentry.workflow_engine.processors.data_source import bulk_fetch_enabled_detectors
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestDataSourceDetectorCacheInvalidationSignals(BaseWorkflowTest):
    @with_feature("organizations:cache-detectors-by-data-source")
    def test_cache_invalidated_on_data_source_detector_create(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_signal_test_1", type="test")

        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        bulk_fetch_enabled_detectors("dsd_signal_test_1", "test")

        with self.assertNumQueries(1):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_1", "test")
            assert len(result) == 1
            assert result[0].id == detector.id

        detector2 = self.create_detector(
            project=self.project, name="Test Detector 2", type=MetricIssue.slug
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector2)

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_1", "test")
            assert len(result) == 2
            assert {d.id for d in result} == {detector.id, detector2.id}

    @with_feature("organizations:cache-detectors-by-data-source")
    def test_cache_invalidated_on_data_source_detector_delete(self) -> None:
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )
        data_source = self.create_data_source(source_id="dsd_signal_test_2", type="test")
        data_source.detectors.set([detector])

        bulk_fetch_enabled_detectors("dsd_signal_test_2", "test")

        with self.assertNumQueries(1):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_2", "test")
            assert len(result) == 1

        DataSourceDetector.objects.filter(data_source=data_source, detector=detector).delete()

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_2", "test")
            assert len(result) == 0

    @with_feature("organizations:cache-detectors-by-data-source")
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

        with self.assertNumQueries(1):
            # 1. Get data source with organization (for feature flag check)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_3", "test")
            assert len(result) == 1
            assert result[0].id == detector1.id

        data_source.detectors.set([detector2])

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss after invalidation)
            result = bulk_fetch_enabled_detectors("dsd_signal_test_3", "test")
            assert len(result) == 1
            assert result[0].id == detector2.id

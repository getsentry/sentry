from unittest.mock import patch

from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.caches.detector import CACHE_PREFIX, CACHE_TTL
from sentry.workflow_engine.models import DataSourceDetector
from sentry.workflow_engine.processors.data_source import bulk_fetch_enabled_detectors
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestGetDetectorsByDataSource(BaseWorkflowTest):
    @with_feature("organizations:cache-detectors-by-data-source")
    def test_get_detectors_by_data_source__single_detector(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector])

        with self.assertNumQueries(2):
            # 1. Get data source with organization (select_related)
            # 2. Get detectors (cache miss)
            result = bulk_fetch_enabled_detectors("12345", "test")

            assert len(result) == 1
            assert result[0].id == detector.id

    @with_feature("organizations:cache-detectors-by-data-source")
    def test_get_detectors_by_data_source__multiple_detectors(self) -> None:
        # Using MessageIssue detector type so that we're able to have multiple detectors on the same data source
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

        result = bulk_fetch_enabled_detectors("12345", "test")

        assert len(result) == 3
        assert {d.id for d in result} == {detector1.id, detector2.id, detector3.id}

    def test_get_detectors_by_data_source__not_found(self) -> None:
        result = bulk_fetch_enabled_detectors("nonexistent", "test")
        assert result == []

    @with_feature("organizations:cache-detectors-by-data-source")
    def test_get_detectors_by_data_source__filters_disabled(self) -> None:
        detector1 = self.create_detector(
            project=self.project, name="Detector 1", type=MetricIssue.slug
        )
        detector2 = self.create_detector(
            project=self.project, name="Detector 2", type=MetricIssue.slug, enabled=False
        )
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector1, detector2])

        result = bulk_fetch_enabled_detectors("12345", "test")

        assert len(result) == 1
        assert result[0].id == detector1.id

    @with_feature("organizations:cache-detectors-by-data-source")
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
            patch("sentry.workflow_engine.caches.cache_access.cache.get") as mock_cache_get,
            patch("sentry.workflow_engine.caches.cache_access.cache.set") as mock_cache_set,
        ):
            mock_cache_get.return_value = None

            result = bulk_fetch_enabled_detectors("12345", "test")

            assert len(result) == 2
            assert {d.id for d in result} == {detector1.id, detector2.id}

            expected_cache_key = f"{CACHE_PREFIX}test:12345"
            mock_cache_get.assert_called_once_with(expected_cache_key)
            mock_cache_set.assert_called_once()
            call_args = mock_cache_set.call_args
            assert call_args[0][0] == expected_cache_key
            cached_detectors = call_args[0][1]
            assert len(cached_detectors) == 2
            assert {d.id for d in cached_detectors} == {detector1.id, detector2.id}
            assert call_args[0][2] == CACHE_TTL

    @with_feature("organizations:cache-detectors-by-data-source")
    def test_get_detectors_by_data_source__cache_hit(self) -> None:
        detector1 = self.create_detector(project=self.project, name="Detector 1")
        detector2 = self.create_detector(project=self.project, name="Detector 2")
        self.create_data_source(source_id="12345", type="test")
        cached_detectors = [detector1, detector2]

        with patch("sentry.workflow_engine.caches.cache_access.cache.get") as mock_cache_get:
            mock_cache_get.return_value = cached_detectors

            result = bulk_fetch_enabled_detectors("12345", "test")

            assert result == cached_detectors

            expected_cache_key = f"{CACHE_PREFIX}test:12345"
            mock_cache_get.assert_called_once_with(expected_cache_key)

    @with_feature("organizations:cache-detectors-by-data-source")
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

        result = bulk_fetch_enabled_detectors("12345", "test")
        assert len(result) == 1

        with self.assertNumQueries(1):
            # 1. Get data source with organization (select_related)
            # Detectors come from cache hit
            cached_result = bulk_fetch_enabled_detectors("12345", "test")
            assert len(cached_result) == 1
            assert cached_result[0].workflow_condition_group is not None
            assert list(cached_result[0].workflow_condition_group.conditions.all())


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
            # 1. Get data source with organization (select_related)
            # Detectors come from cache hit
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
            # 1. Get data source with organization (select_related)
            # Detectors come from cache hit
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
            # 1. Get data source with organization (select_related)
            # Detectors come from cache hit
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
            # 1. Get data source 4a with organization (select_related)
            # 2. Get data source 4b with organization (select_related)
            # Detectors come from cache hits
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
            # 1. Get data source with organization (select_related)
            # Detectors come from cache hit
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
            # 1. Get data source with organization (select_related)
            # Detectors come from cache hit
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
            # 1. Get data source with organization (select_related)
            # Detectors come from cache hit
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

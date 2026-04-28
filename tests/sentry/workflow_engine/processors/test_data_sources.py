from unittest import mock
from unittest.mock import patch

from sentry.incidents.grouptype import MetricIssue
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.caches.detector import (
    CACHE_TTL,
    _DetectorCacheKey,
    _detectors_by_data_source,
)
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors.data_source import (
    bulk_fetch_enabled_detectors,
    process_data_source,
)
from sentry.workflow_engine.registry import data_source_type_registry
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestProcessDataSources(BaseWorkflowTest):
    def setUp(self) -> None:
        # check that test_base registers the data_source_type_registry
        assert isinstance(data_source_type_registry.get("test"), mock.Mock)

        self.query = self.create_snuba_query()
        self.query_two = self.create_snuba_query()

        self.detector_one = self.create_detector(name="test_detector1")
        self.detector_two = self.create_detector(name="test_detector2", type="metric_issue")

        self.detector_one.workflow_condition_group = self.create_data_condition_group(
            logic_type="any"
        )

        self.create_data_condition(
            condition_group=self.detector_one.workflow_condition_group,
            type="eq",
            comparison="bar",
            condition_result=True,
        )
        self.detector_one.save()

        source_id_1 = "12345-test-source-1"
        self.ds1 = self.create_data_source(source_id=source_id_1, type="test")
        self.ds1.detectors.set([self.detector_one])

        source_id_2 = "56789-test-source-2"
        self.ds2 = self.create_data_source(source_id=source_id_2, type="test")
        self.ds2.detectors.set([self.detector_one, self.detector_two])

        self.packet = DataPacket[dict[str, str]](
            source_id_1, {"source_id": source_id_1, "foo": "bar"}
        )
        self.two_detector_packet = DataPacket[dict[str, str]](
            source_id_2, {"source_id": source_id_2, "foo": "baz"}
        )

    def test_single_data_packet(self) -> None:
        assert process_data_source(self.packet, "test") == (self.packet, [self.detector_one])

    def test_disabled_detector(self) -> None:
        self.detector_one.enabled = False
        self.detector_one.save()

        assert process_data_source(self.two_detector_packet, "test") == (
            self.two_detector_packet,
            [self.detector_two],
        )

    def test_multiple_detectors(self) -> None:
        self.detector_three = self.create_detector(name="test_detector3")
        self.detector_four = self.create_detector(name="test_detector4")

        self.ds2.detectors.add(self.detector_three)
        self.ds2.detectors.add(self.detector_four)

        assert process_data_source(self.two_detector_packet, "test") == (
            self.two_detector_packet,
            [self.detector_one, self.detector_two, self.detector_three, self.detector_four],
        )

    def test_no_results(self) -> None:
        self.ds2.detectors.clear()
        assert process_data_source(self.two_detector_packet, "test") == (
            self.two_detector_packet,
            [],
        )

    def test_different_data_packet_type__no_results(self) -> None:
        assert process_data_source(self.packet, "test2") == (self.packet, [])

    def test_metrics_are_sent_for_data_sources(self) -> None:
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_source(self.packet, "test")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources", tags={"query_type": "test"}
            )

    def test_metrics_are_sent_for_no_detectors(self) -> None:
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_source(self.packet, "test3")
            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources.no_detectors",
                tags={"query_type": "test3"},
            )

    def test_metrics_for_many_detectors(self) -> None:
        self.detector_three = self.create_detector(name="test_detector3")
        self.ds1.detectors.add(self.detector_three)

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_source(self.packet, "test")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources.detectors",
                2,
                tags={"query_type": "test"},
            )

    def test_sql_cascades(self) -> None:
        with self.assertNumQueries(3):
            """
            There are 3 SQL queries for `bulk_fetch_enabled_detectors`:
            - Get the data source with organization (select_related, for feature flag check)
            - Get the detector and data condition group (via join through data source mapping)
            - Get all the data conditions for the group (prefetch)
            """
            _, detectors = process_data_source(self.two_detector_packet, "test")
            # If the detector is not prefetched this will increase the query count
            assert all(detector.enabled for detector in detectors)

            for detector in detectors:
                if detector.workflow_condition_group:
                    # Trigger a SQL query if not prefetched, and fail the assertion
                    assert detector.workflow_condition_group.id is not None

                    for condition in detector.workflow_condition_group.conditions.all():
                        # Trigger a SQL query if not prefetched, and fail the assertion
                        assert condition.id is not None


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

    def test_get_detectors_by_data_source__wrong_type(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")
        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector])

        # Query with wrong type should not find the data source
        result = bulk_fetch_enabled_detectors("12345", "wrong_type")
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
            patch("sentry.utils.cache.cache.get") as mock_cache_get,
            patch("sentry.utils.cache.cache.set") as mock_cache_set,
        ):
            mock_cache_get.return_value = None

            result = bulk_fetch_enabled_detectors("12345", "test")

            assert len(result) == 2
            assert {d.id for d in result} == {detector1.id, detector2.id}

            expected_cache_key = _detectors_by_data_source.key(_DetectorCacheKey("12345", "test"))
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

        with patch("sentry.utils.cache.cache.get") as mock_cache_get:
            mock_cache_get.return_value = cached_detectors

            result = bulk_fetch_enabled_detectors("12345", "test")

            assert result == cached_detectors

            expected_cache_key = _detectors_by_data_source.key(_DetectorCacheKey("12345", "test"))
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
            # 1. Get data source with organization (for feature flag check)
            cached_result = bulk_fetch_enabled_detectors("12345", "test")
            assert len(cached_result) == 1
            assert cached_result[0].workflow_condition_group is not None
            assert list(cached_result[0].workflow_condition_group.conditions.all())

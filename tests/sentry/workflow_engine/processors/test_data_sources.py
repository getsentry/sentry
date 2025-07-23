from unittest import mock

from sentry.snuba.models import SnubaQuery
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import process_data_source
from sentry.workflow_engine.registry import data_source_type_registry
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestProcessDataSources(BaseWorkflowTest):
    def create_snuba_query(self, **kwargs):
        return SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
            **kwargs,
        )

    def setUp(self):
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

        self.packet = DataPacket[dict](source_id_1, {"source_id": source_id_1, "foo": "bar"})
        self.two_detector_packet = DataPacket[dict](
            source_id_2, {"source_id": source_id_2, "foo": "baz"}
        )

    def test_single_data_packet(self):
        assert process_data_source(self.packet, "test") == (self.packet, [self.detector_one])

    def test_disabled_detector(self):
        self.detector_one.enabled = False
        self.detector_one.save()

        assert process_data_source(self.two_detector_packet, "test") == (
            self.two_detector_packet,
            [self.detector_two],
        )

    def test_multiple_detectors(self):
        self.detector_three = self.create_detector(name="test_detector3")
        self.detector_four = self.create_detector(name="test_detector4")

        self.ds2.detectors.add(self.detector_three)
        self.ds2.detectors.add(self.detector_four)

        assert process_data_source(self.two_detector_packet, "test") == (
            self.two_detector_packet,
            [self.detector_one, self.detector_two, self.detector_three, self.detector_four],
        )

    def test_no_results(self):
        self.ds2.detectors.clear()
        assert process_data_source(self.two_detector_packet, "test") == (
            self.two_detector_packet,
            [],
        )

    def test_different_data_packet_type__no_results(self):
        assert process_data_source(self.packet, "test2") == (self.packet, [])

    def test_metrics_are_sent_for_data_sources(self):
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_source(self.packet, "test")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources", tags={"query_type": "test"}
            )

    def test_metrics_are_sent_for_no_detectors(self):
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_source(self.packet, "test3")
            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources.no_detectors",
                tags={"query_type": "test3"},
            )

    def test_metrics_for_many_detectors(self):
        self.detector_three = self.create_detector(name="test_detector3")
        self.ds1.detectors.add(self.detector_three)

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_source(self.packet, "test")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources.detectors",
                2,
                tags={"query_type": "test"},
            )

    def test_sql_cascades(self):
        with self.assertNumQueries(2):
            """
            There should be 2 total SQL queries for `bulk_fetch_enabled_detectors`:
            - Get the detector and data condition group associated with it
            - Get all the data conditions for the group
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

from unittest import mock

from sentry.snuba.models import SnubaQuery
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import process_data_sources
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
        self.detector_two = self.create_detector(name="test_detector2", type="metric_alert_fire")

        self.ds1 = self.create_data_source(source_id=self.query.id, type="test")
        self.ds1.detectors.set([self.detector_one])

        self.ds2 = self.create_data_source(source_id=self.query_two.id, type="test")
        self.ds2.detectors.set([self.detector_two])

        self.packet = DataPacket[dict](
            str(self.query.id), {"source_id": self.query.id, "foo": "bar"}
        )
        self.packet_two = DataPacket[dict](
            str(self.query_two.id), {"source_id": self.query_two.id, "foo": "baz"}
        )

        self.data_packets = [self.packet, self.packet_two]

    def test_single_data_packet(self):
        assert process_data_sources([self.packet], "test") == [(self.packet, [self.detector_one])]

    def test_multiple_data_packets(self):
        assert process_data_sources(self.data_packets, "test") == [
            (self.packet, [self.detector_one]),
            (self.packet_two, [self.detector_two]),
        ]

    def test_multiple_detectors(self):
        self.detector_three = self.create_detector(name="test_detector3")
        self.detector_four = self.create_detector(name="test_detector4")
        self.detector_five = self.create_detector(name="test_detector5")
        self.detector_five = self.create_detector(name="test_detector5")

        self.ds2.detectors.add(self.detector_three)
        self.ds2.detectors.add(self.detector_four)
        self.ds2.detectors.add(self.detector_five)

        assert process_data_sources(self.data_packets, "test") == [
            (self.packet, [self.detector_one]),
            (
                self.packet_two,
                [self.detector_two, self.detector_three, self.detector_four, self.detector_five],
            ),
        ]

    def test_no_results(self):
        self.ds1.detectors.clear()
        self.ds2.detectors.clear()

        assert process_data_sources(self.data_packets, "test") == []

    def test_different_data_packet_type__no_results(self):
        assert process_data_sources(self.data_packets, "test2") == []

    def test_different_data_packet_type__with_results(self):
        self.ds1.type = "test"
        self.ds1.save()

        self.ds2.type = "test"
        self.ds2.save()

        assert process_data_sources(
            self.data_packets,
            "test",
        ) == [
            (self.packet, [self.detector_one]),
            (self.packet_two, [self.detector_two]),
        ]

    def test_metrics_are_sent_for_data_sources(self):
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_sources(self.data_packets, "test")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources", tags={"query_type": "test"}
            )

    def test_metrics_are_sent_for_detector_types(self):
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_sources(self.data_packets, "test")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources.detectors",
                1,
                tags={"detector_type": self.detector_one.type},
            )

    def test_metrics_are_sent_for_no_detectors(self):
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_sources(self.data_packets, "test3")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources.no_detectors",
                tags={"query_type": "test3"},
            )

    def test_metrics_for_many_detectors(self):
        self.detector_three = self.create_detector(name="test_detector3")
        self.ds1.detectors.add(self.detector_three)

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_data_sources(self.data_packets, "test")

            mock_incr.assert_any_call(
                "workflow_engine.process_data_sources.detectors",
                2,
                tags={"detector_type": self.detector_one.type},
            )

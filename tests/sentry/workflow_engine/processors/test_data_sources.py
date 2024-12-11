from unittest.mock import PropertyMock, patch

import pytest

from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.utils.registry import Registry
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import process_data_sources


class TestProcessDataSources(TestCase):
    def create_snuba_query(self, **kwargs):
        return SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
            **kwargs,
        )

    @pytest.fixture(autouse=True)
    def initialize_detector_config_registry(self):
        # all detectors in this test case have type=""
        self.example_registry = Registry[str](enable_reverse_lookup=False)
        self.example_registry.register("")(json.dumps({}))
        with patch(
            "sentry.workflow_engine.models.Detector.CONFIG_SCHEMA_REGISTRY",
            return_value=self.example_registry,
            new_callable=PropertyMock,
        ):
            # Run test case
            yield

    def setUp(self):
        self.query = self.create_snuba_query()
        self.query_two = self.create_snuba_query()

        self.detector_one = self.create_detector(name="test_detector1")
        self.detector_two = self.create_detector(name="test_detector2")

        self.ds1 = self.create_data_source(query_id=self.query.id, type="test")
        self.ds1.detectors.set([self.detector_one])

        self.ds2 = self.create_data_source(query_id=self.query_two.id, type="test")
        self.ds2.detectors.set([self.detector_two])

        self.packet = DataPacket[dict](self.query.id, {"query_id": self.query.id, "foo": "bar"})
        self.packet_two = DataPacket[dict](
            self.query_two.id, {"query_id": self.query_two.id, "foo": "baz"}
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

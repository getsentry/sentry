from typing import int
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.workflow_engine.processors.data_packet import process_data_packet
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestProcessDataPacket(BaseWorkflowTest):
    def setUp(self) -> None:
        self.snuba_query = self.create_snuba_query()

        (self.workflow, self.detector, self.detector_workflow, self.workflow_triggers) = (
            self.create_detector_and_workflow()
        )

        _, _, self.data_source, self.data_packet = self.create_test_query_data_source(self.detector)

    def test_single_data_packet(self) -> None:
        results = process_data_packet(self.data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)
        assert len(results) == 1

        detector, detector_evaluation_result = results[0]
        assert detector_evaluation_result[None].priority == DetectorPriorityLevel.HIGH

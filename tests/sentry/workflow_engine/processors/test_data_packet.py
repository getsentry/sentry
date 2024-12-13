from sentry.workflow_engine.processors.data_packet import process_data_packets
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestProcessDataPacket(BaseWorkflowTest):
    def setUp(self):
        self.snuba_query = self.create_snuba_query()

        (self.workflow, self.detector, self.detector_workflow, self.workflow_triggers) = (
            self.create_detector_and_workflow()
        )

        self.data_source, self.data_packet = self.create_test_query_data_source(self.detector)

    def test_single_data_packet(self):
        results = process_data_packets([self.data_packet], "snuba_query_subscription")
        assert len(results) == 1

        detector, detector_evaluation_result = results[0]
        assert detector_evaluation_result[None].priority == DetectorPriorityLevel.HIGH

from dataclasses import dataclass

from sentry.issues.issue_occurrence import IssueEvidence
from sentry.workflow_engine.handlers.detector import DetectorHandler, DetectorOccurrence
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import DataConditionGroupEvaluation
from sentry.workflow_engine.types import DetectorPriorityLevel


@dataclass(frozen=True)
class TestDataPacket:
    __test__ = False

    measurement: int
    service_name: str
    region: str


class ExampleDetectorHandler(DetectorHandler[TestDataPacket, int]):
    def extract_value(self, data_packet: DataPacket[TestDataPacket]) -> int:
        return data_packet.packet.measurement

    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[TestDataPacket],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        packet = data_packet.packet

        occurrence = DetectorOccurrence(
            issue_title=f"{packet.service_name} measurement is too high",
            subtitle=f"Measured {packet.measurement} in {packet.region}",
            evidence_data={
                "measurement": packet.measurement,
                "service_name": packet.service_name,
                "region": packet.region,
            },
            evidence_display=[
                IssueEvidence(name="Measurement", value=str(packet.measurement), important=True),
                IssueEvidence(name="Service", value=packet.service_name, important=False),
                IssueEvidence(name="Region", value=packet.region, important=False),
            ],
            type=self.detector.group_type,
            level="error",
            culprit=packet.service_name,
            priority=priority,
        )

        event_data: EventData = {
            "tags": {"service_name": packet.service_name, "region": packet.region},
        }

        return occurrence, event_data

from typing import int
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors.data_source import process_data_source
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.types import DetectorEvaluationResult, DetectorGroupKey


def process_data_packet[T](
    data_packet: DataPacket[T], query_type: str
) -> list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]]:
    """
    This method ties the two main pre-processing methods together to process
    the incoming data and create issue occurrences.

    This is the general entry point for the workflow engine. It will create
    a metric pipeline with the following metrics:
    - workflow_engine.process_data_sources
        - workflow_engine.process_data_sources.detectors
        - workflow_engine.process_data_sources.no_detectors
    - workflow_engine.process_detectors
        - workflow_engine.process_detectors.triggered
    - workflow_engine.process_workflows
        - workflow_engine.process_workflows.triggered_workflows
        - workflow_engine.process_workflows.triggered_actions

    This metric funnel can be used to monitor the health of the workflow engine.
    TODO - saponifi3d - Create a monitoring dashboard for the workflow engine and link it here
         - the dashboard should show the funnel as we process data.
    """
    data_packet, detectors = process_data_source(data_packet, query_type)
    return process_detectors(data_packet, detectors)

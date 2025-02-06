from sentry.workflow_engine.handlers.detector import DetectorEvaluationResult
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors.data_source import process_data_sources
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.types import DetectorGroupKey


def process_data_packets(
    data_packets: list[DataPacket], query_type: str
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
    processed_sources = process_data_sources(data_packets, query_type)

    results: list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]] = []
    for data_packet, detectors in processed_sources:
        detector_results = process_detectors(data_packet, detectors)

        for detector, detector_state in detector_results:
            results.append((detector, detector_state))

    return results

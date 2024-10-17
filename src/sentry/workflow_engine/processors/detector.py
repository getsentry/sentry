import logging

from sentry.workflow_engine.models import DataPacket, Detector, DetectorEvaluationResult

logger = logging.getLogger(__name__)


def process_detectors(
    data_packet: DataPacket, detectors: list[Detector]
) -> list[tuple[Detector, list[DetectorEvaluationResult]]]:
    results = []

    for detector in detectors:
        handler = detector.detector_handler

        if not handler:
            continue

        detector_results = handler.evaluate(data_packet)
        detector_group_keys = set()

        for result in detector_results:
            if result.state_update_data:
                if result.state_update_data.group_key in detector_group_keys:
                    # This shouldn't happen - log an error and continue on, but we should investigate this.
                    logger.error(
                        "Duplicate detector state group keys found",
                        extra={
                            "detector_id": detector.id,
                            "group_key": result.state_update_data.group_key,
                        },
                    )
                detector_group_keys.add(result.state_update_data.group_key)

        if detector_results:
            results.append((detector, detector_results))

    return results

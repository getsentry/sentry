import logging

import sentry_sdk

from sentry.utils import metrics
from sentry.workflow_engine.models import DataPacket, DataSource, Detector

logger = logging.getLogger("sentry.workflow_engine.process_data_source")


def bulk_fetch_enabled_detectors(
    source_ids: set[str], query_type: str
) -> dict[str, list[Detector]]:
    """
    Get a list of detectors for each source id, filter out any disabled detectors.

    TODO - Investigate if this should use a cache value to fetch the detectors by a single source_id instead
    of querying for it directly. First, ensure this addresses the query cascade.
    """
    data_sources = DataSource.objects.filter(
        source_id__in=source_ids,
        type=query_type,
        detectors__enabled=True,
    ).prefetch_related(
        "detectors",
        "detectors__workflow_condition_group",
        "detectors__workflow_condition_group__conditions",
    )

    result: dict[str, list[Detector]] = {}

    for data_source in data_sources:
        result[data_source.source_id] = list(data_source.detectors.all())

    return result


# TODO - @saponifi3d - make query_type optional override, otherwise infer from the data packet.
def process_data_sources[
    T
](data_packets: list[DataPacket[T]], query_type: str) -> list[tuple[DataPacket[T], list[Detector]]]:
    metrics.incr("workflow_engine.process_data_sources", tags={"query_type": query_type})

    with sentry_sdk.start_span(op="workflow_engine.process_data_sources.get_enabled_detectors"):
        packet_source_ids = {packet.source_id for packet in data_packets}
        source_to_detector = bulk_fetch_enabled_detectors(packet_source_ids, query_type)

    # Create the result tuples using cached, fully prefetched detectors
    result = []
    for packet in data_packets:
        detectors: list[Detector] = source_to_detector.get(packet.source_id, [])

        if detectors:
            data_packet_tuple = (packet, detectors)
            result.append(data_packet_tuple)

            metrics.incr(
                "workflow_engine.process_data_sources.detectors",
                len(detectors),
                tags={"query_type": query_type},
            )

            logger.info(
                "workflow_engine.process_data_sources detectors",
                extra={
                    "detectors": [detector.id for detector in detectors],
                    "source_id": packet.source_id,
                },
            )
        else:
            # XXX: this likely means the rule is muted / detector is disabled
            logger.warning(
                "workflow_engine.process_data_sources no detectors",
                extra={"source_id": packet.source_id, "query_type": query_type},
            )
            metrics.incr(
                "workflow_engine.process_data_sources.no_detectors",
                tags={"query_type": query_type},
            )

    return result

import logging

import sentry_sdk
from django.db.models import Prefetch

from sentry.utils import metrics
from sentry.workflow_engine.models import DataPacket, DataSource, Detector

logger = logging.getLogger("sentry.workflow_engine.process_data_source")


# TODO - @saponifi3d - change the text choices to an enum
# TODO - @saponifi3d - make query_type optional override, otherwise infer from the data packet.
def process_data_sources[
    T
](data_packets: list[DataPacket[T]], query_type: str) -> list[tuple[DataPacket[T], list[Detector]]]:
    metrics.incr("workflow_engine.process_data_sources", tags={"query_type": query_type})

    data_packet_ids = {packet.source_id for packet in data_packets}

    # Fetch all data sources and associated detectors for the given data packets
    with sentry_sdk.start_span(op="workflow_engine.process_data_sources.fetch_data_sources"):
        data_sources = DataSource.objects.filter(
            source_id__in=data_packet_ids,
            type=query_type,
            detectors__enabled=True,
        ).prefetch_related(Prefetch("detectors"))

    # Build a lookup dict for source_id to detectors
    source_id_to_detectors = {ds.source_id: list(ds.detectors.all()) for ds in data_sources}

    # Create the result tuples
    result = []
    for packet in data_packets:
        detectors = source_id_to_detectors.get(packet.source_id)

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

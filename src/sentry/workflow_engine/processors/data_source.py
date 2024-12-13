import logging

import sentry_sdk
from django.db.models import Prefetch

from sentry.utils import metrics
from sentry.workflow_engine.models import DataPacket, DataSource, Detector

logger = logging.getLogger("sentry.workflow_engine.process_data_source")


def process_data_sources(
    data_packets: list[DataPacket], query_type: str
) -> list[tuple[DataPacket, list[Detector]]]:
    metrics.incr("sentry.workflow_engine.process_data_sources", tags={"query_type": query_type})

    # TODO - change data_source.query_id to be a string to support UUIDs
    data_packet_ids = {int(packet.query_id) for packet in data_packets}

    # Fetch all data sources and associated detectors for the given data packets
    with sentry_sdk.start_span(op="sentry.workflow_engine.process_data_sources.fetch_data_sources"):
        data_sources = DataSource.objects.filter(
            query_id__in=data_packet_ids, type=query_type
        ).prefetch_related(Prefetch("detectors"))

    # Build a lookup dict for query_id to detectors
    query_id_to_detectors = {int(ds.query_id): list(ds.detectors.all()) for ds in data_sources}

    # Create the result tuples
    result = []
    for packet in data_packets:
        detectors = query_id_to_detectors.get(int(packet.query_id))

        if detectors:
            data_packet_tuple = (packet, detectors)
            result.append(data_packet_tuple)
        else:
            logger.warning(
                "No detectors found", extra={"query_id": packet.query_id, "query_type": query_type}
            )
            metrics.incr(
                "sentry.workflow_engine.process_data_sources.no_detectors",
                tags={"query_type": query_type},
            )

    return result

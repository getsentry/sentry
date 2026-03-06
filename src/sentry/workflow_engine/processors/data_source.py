import logging

import sentry_sdk

from sentry import features
from sentry.utils import metrics
from sentry.workflow_engine.caches.detector import (
    _query_detectors,
    get_detectors_by_data_source,
)
from sentry.workflow_engine.models import DataPacket, DataSource, Detector

logger = logging.getLogger("sentry.workflow_engine.process_data_source")


def bulk_fetch_enabled_detectors(source_id: str, query_type: str) -> list[Detector]:
    """
    Get all of the enabled detectors for a list of detector source ids and types.
    This will also prefetch all the subsequent data models for evaluating the detector.
    """

    try:
        data_source = DataSource.objects.select_related("organization").get(
            source_id=source_id, type=query_type
        )
        organization = data_source.organization
    except DataSource.DoesNotExist:
        logger.warning(
            "workflow_engine.process_data_sources.data_source_not_found",
            extra={"source_id": source_id},
        )
        return []

    if features.has("organizations:cache-detectors-by-data-source", organization):
        return get_detectors_by_data_source(source_id, query_type)
    else:
        return _query_detectors(source_id, query_type)


# TODO - @saponifi3d - make query_type optional override, otherwise infer from the data packet.
def process_data_source[T](
    data_packet: DataPacket[T], query_type: str
) -> tuple[DataPacket[T], list[Detector]]:
    metrics.incr("workflow_engine.process_data_sources", tags={"query_type": query_type})

    with sentry_sdk.start_span(op="workflow_engine.process_data_sources.get_enabled_detectors"):
        detectors = bulk_fetch_enabled_detectors(data_packet.source_id, query_type)

    if detectors:
        metrics.incr(
            "workflow_engine.process_data_sources.detectors",
            len(detectors),
            tags={"query_type": query_type},
        )
    else:
        # XXX: this likely means the rule is muted / detector is disabled
        logger.warning(
            "workflow_engine.process_data_sources no detectors",
            extra={"source_id": data_packet.source_id, "query_type": query_type},
        )
        metrics.incr(
            "workflow_engine.process_data_sources.no_detectors",
            tags={"query_type": query_type},
        )

    return data_packet, detectors

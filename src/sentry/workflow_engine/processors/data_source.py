import logging

import sentry_sdk

from sentry import features
from sentry.utils import metrics
from sentry.workflow_engine.caches.detector import DetectorByDataSourceCacheAccess
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
        cache_access = DetectorByDataSourceCacheAccess(source_id, query_type)
        detectors = cache_access.get()
        if detectors is None:
            detectors = list(
                Detector.objects.filter(
                    data_sources__source_id=source_id,
                    data_sources__type=query_type,
                    enabled=True,
                )
                .select_related("workflow_condition_group")
                .prefetch_related("workflow_condition_group__conditions")
                .distinct()
                .order_by("id")
            )
            cache_access.set(detectors, cache_access.cache_ttl)
        return detectors

    else:
        return list(
            Detector.objects.filter(
                enabled=True, data_sources__source_id=source_id, data_sources__type=query_type
            )
            .select_related("workflow_condition_group")
            .prefetch_related("workflow_condition_group__conditions")
            .distinct()
            .order_by("id")
        )


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

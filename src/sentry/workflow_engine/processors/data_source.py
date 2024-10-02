from django.db.models import Prefetch

from sentry.workflow_engine.models import DataPacket, DataSource, Detector


def process_data_sources(
    data_packets: list[DataPacket], query_type: DataSource.Type = DataSource.Type.SNUBA_QUERY
) -> list[tuple[DataPacket, list[Detector]]]:
    data_packet_ids = [packet.id for packet in data_packets]

    # Fetch all data sources and associated detectors for the given data packets
    data_sources = DataSource.objects.filter(
        query_id__in=data_packet_ids, type=query_type
    ).prefetch_related(Prefetch("datasourcedetector_set__detector", to_attr="detectors"))

    # Build a lookup dict for query_id to detectors
    query_id_to_detectors = {ds.query_id: ds.detectors for ds in data_sources}

    # TODO @saponifi3d: Add ability to lookup detector subclasses

    # Create the result tuples
    result = []
    for packet in data_packets:
        detectors = query_id_to_detectors.get(packet.id)

        if detectors:
            data_packet_tuple = (packet, list(detectors.all()))
        else:
            data_packet_tuple = (packet, [])

        result.append(data_packet_tuple)

    return result

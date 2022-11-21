from typing import MutableMapping

from arroyo import Message, Topic
from confluent_kafka import Producer
from django.conf import settings

from sentry.ingest.slicing import (
    Sliceable,
    is_sliced,
    map_logical_partition_to_slice,
    map_org_id_to_logical_partition,
)
from sentry.sentry_metrics.consumers.indexer.routing_producer import (
    MessageRoute,
    MessageRouter,
    RoutingPayload,
)
from sentry.utils import kafka_config


class SlicingConfigurationException(Exception):
    """
    Exception raised when the configuration for the SlicingRouter is invalid.
    """


class MissingOrgInRoutingHeader(Exception):
    """
    Exception raised when the routing header does not contain an org_id.
    """


def _validate_slicing_consumer_config(sliceable: Sliceable) -> None:
    """
    Validate all the required settings needed for a slicing router.
    """
    if not is_sliced(sliceable):
        raise SlicingConfigurationException(
            f"{sliceable} is not defined in settings.SENTRY_SLICING_CONFIG"
        )

    for (current_sliceable, slice_id), configuration in settings.SLICED_KAFKA_TOPICS.items():
        if current_sliceable != sliceable:
            continue

        if "topic" not in configuration:
            raise SlicingConfigurationException(
                f"({current_sliceable}, {slice_id}) is missing a topic name."
            )
        if "cluster" not in configuration:
            raise SlicingConfigurationException(
                f"({current_sliceable}, {slice_id}) is missing a cluster name."
            )
        cluster = configuration["cluster"]
        if cluster not in settings.KAFKA_CLUSTERS:
            raise SlicingConfigurationException(
                f"Broker configuration missing for {cluster} in settings.KAFKA_CLUSTERS"
            )


class SlicingRouter(MessageRouter):
    """
    Router which works based on the settings defined for slicing.
    """

    def __init__(
        self,
        sliceable: Sliceable,
    ) -> None:
        self.__sliceable = sliceable
        self.__slice_to_producer: MutableMapping[int, MessageRoute] = {}
        _validate_slicing_consumer_config(self.__sliceable)

        for (
            current_sliceable,
            current_slice_id,
        ), configuration in settings.SLICED_KAFKA_TOPICS.items():
            self.__slice_to_producer[current_slice_id] = MessageRoute(
                producer=Producer(
                    kafka_config.get_kafka_producer_cluster_options(configuration["cluster"])
                ),
                topic=Topic(configuration["topic"]),
            )
        assert len(self.__slice_to_producer) == len(
            settings.SENTRY_SLICING_CONFIG[sliceable].keys()
        )

    def get_route_for_message(self, message: Message[RoutingPayload]) -> MessageRoute:
        """
        Get route for the message. The message will be routed based on the org_id
        present in the message payload header and how it maps to a specific
        slice.
        """
        org_id = message.payload.routing_header.get("org_id", None)

        if org_id is None:
            raise MissingOrgInRoutingHeader("org_id is missing from the routing header")
        else:
            slice_id = map_logical_partition_to_slice(
                self.__sliceable, map_org_id_to_logical_partition(org_id)
            )
            producer = self.__slice_to_producer[slice_id]

        return producer

    def shutdown(self) -> None:
        for route in self.__slice_to_producer.values():
            route.producer.flush()

from datetime import datetime

import pytest
from arroyo import Message, Partition, Topic
from arroyo.backends.kafka import KafkaPayload

from sentry.conf.server import (
    KAFKA_SNUBA_GENERIC_METRICS,
    SENTRY_SLICING_CONFIG,
    SENTRY_SLICING_LOGICAL_PARTITION_COUNT,
    SLICED_KAFKA_BROKER_CONFIG,
    SLICED_KAFKA_TOPIC_MAP,
)
from sentry.sentry_metrics.consumers.indexer.routing_producer import RoutingPayload
from sentry.sentry_metrics.consumers.indexer.slicing_router import (
    SlicingConfigurationException,
    SlicingRouter,
    _validate_slicing_consumer_config,
)


@pytest.fixture
def metrics_message(org_id: int) -> Message[RoutingPayload]:
    return Message(
        partition=Partition(Topic("source_topic"), 0),
        payload=RoutingPayload(
            routing_header={"org_id": org_id},
            payload=KafkaPayload(
                key=b"",
                value=b"{}",
                headers=[],
            ),
        ),
        offset=0,
        timestamp=datetime.now(),
    )


@pytest.fixture
def setup_slicing(monkeypatch) -> None:
    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "generic_metrics_sets", {(0, 128): 0, (128, 256): 1}  # type: ignore
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPIC_MAP, (KAFKA_SNUBA_GENERIC_METRICS, 0), "sliced_topic_0"  # type: ignore
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPIC_MAP, (KAFKA_SNUBA_GENERIC_METRICS, 1), "sliced_topic_1"  # type: ignore
    )
    monkeypatch.setitem(
        SLICED_KAFKA_BROKER_CONFIG,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 0),
        {"bootstrap.servers": "127.0.0.1:9092"},
    )
    monkeypatch.setitem(
        SLICED_KAFKA_BROKER_CONFIG,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 1),
        {"bootstrap.servers": "127.0.0.1:9092"},
    )


@pytest.mark.parametrize("org_id", [1, 127, 128, 256, 257])
def test_slicing_router_with_slicing(metrics_message, setup_slicing) -> None:
    """
    With partitioning settings, the SlicingRouter should route to the correct topic
    based on the org_id header.
    """
    org_id = metrics_message.payload.routing_header.get("org_id")
    router = SlicingRouter("generic_metrics_sets")
    route = router.get_route_for_message(metrics_message)
    if int(org_id) % SENTRY_SLICING_LOGICAL_PARTITION_COUNT < 128:
        assert route.topic.name == "sliced_topic_0"
    elif int(org_id) % SENTRY_SLICING_LOGICAL_PARTITION_COUNT < 256:
        assert route.topic.name == "sliced_topic_1"
    else:
        assert False, "unexpected org_id"
    router.shutdown()


@pytest.mark.parametrize("org_id", [100])
def test_slicing_router_with_misconfiguration(metrics_message, monkeypatch):
    """
    Configuring topic override only does not kick in routing logic. So the
    messages should be routed to the logical topic.
    """
    monkeypatch.setitem(
        SLICED_KAFKA_TOPIC_MAP, (KAFKA_SNUBA_GENERIC_METRICS, 0), "sliced_topic_0"  # type: ignore
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPIC_MAP, (KAFKA_SNUBA_GENERIC_METRICS, 1), "sliced_topic_1"  # type: ignore
    )

    with pytest.raises(SlicingConfigurationException):
        _ = SlicingRouter("generic_metrics_sets")


def test_validate_slicing_consumer_config(monkeypatch) -> None:
    """
    Validate that the slicing consumer config is valid.
    """
    with pytest.raises(
        SlicingConfigurationException, match=r"not defined " r"in settings.SENTRY_SLICING_CONFIG"
    ):
        _validate_slicing_consumer_config("generic_metrics_sets")

    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "generic_metrics_sets", {(0, 128): 0, (128, 256): 1}  # type: ignore
    )

    monkeypatch.setitem(
        SLICED_KAFKA_TOPIC_MAP, (KAFKA_SNUBA_GENERIC_METRICS, 0), "sliced_topic_0"  # type: ignore
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPIC_MAP, (KAFKA_SNUBA_GENERIC_METRICS, 1), "sliced_topic_1"  # type: ignore
    )
    monkeypatch.setitem(
        SLICED_KAFKA_BROKER_CONFIG,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 0),
        {"bootstrap.servers": "127.0.0.1:9092"},
    )
    with pytest.raises(SlicingConfigurationException, match=r"missing topic " r"definition"):
        _validate_slicing_consumer_config("generic_metrics_sets")

    monkeypatch.setitem(
        SLICED_KAFKA_BROKER_CONFIG,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 1),
        {"bootstrap.servers": "127.0.0.1:9092"},
    )

    try:
        _validate_slicing_consumer_config("generic_metrics_sets")
    except SlicingConfigurationException as e:
        assert False, f"Should not raise exception: {e}"

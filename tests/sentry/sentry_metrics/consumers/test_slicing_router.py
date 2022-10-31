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
from sentry.sentry_metrics.consumers.indexer.slicing_router import SlicingRouter


@pytest.fixture
def metrics_message(org_id: int) -> Message[KafkaPayload]:
    header = [("org_id", str(org_id).encode("utf-8"))] if org_id > 0 else []
    return Message(
        partition=Partition(Topic("source_topic"), 0),
        payload=KafkaPayload(
            key=b"",
            value=b"{}",
            headers=header,
        ),
        offset=0,
        timestamp=datetime.now(),
    )


@pytest.fixture
def setup_slicing(monkeypatch):
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


@pytest.mark.parametrize("org_id", [100, 1000])
def test_slicing_router_with_no_partitioning(metrics_message):
    """
    With default settings, the SlicingRouter should always route to the topic
    whose name is the same as the logical topic name.
    """
    router = SlicingRouter("generic_metrics_sets", KAFKA_SNUBA_GENERIC_METRICS)
    route = router.get_route_for_message(metrics_message)
    assert route.topic.name == KAFKA_SNUBA_GENERIC_METRICS
    router.shutdown()


@pytest.mark.parametrize("org_id", [1, 127, 128, 256, 257])
def test_slicing_router_with_partitioning(metrics_message, setup_slicing):
    """
    With partitioning settings, the SlicingRouter should route to the correct topic
    based on the org_id header.
    """
    org_id = metrics_message.payload.headers[0][1].decode("utf-8")
    router = SlicingRouter("generic_metrics_sets", KAFKA_SNUBA_GENERIC_METRICS)
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

    router = SlicingRouter("generic_metrics_sets", KAFKA_SNUBA_GENERIC_METRICS)
    route = router.get_route_for_message(metrics_message)
    assert route.topic.name == KAFKA_SNUBA_GENERIC_METRICS
    router.shutdown()


@pytest.mark.parametrize("org_id", [0])
def test_slicing_router_with_no_org_in_message(metrics_message, setup_slicing):
    """
    When no org id is present in the message, the message should be routed to slice 0.
    """
    router = SlicingRouter("generic_metrics_sets", KAFKA_SNUBA_GENERIC_METRICS)
    assert metrics_message.payload.headers == []
    route = router.get_route_for_message(metrics_message)
    assert route.topic.name == "sliced_topic_0"
    router.shutdown()

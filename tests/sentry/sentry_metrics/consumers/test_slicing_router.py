from datetime import datetime

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.conf.server import (
    KAFKA_CLUSTERS,
    KAFKA_SNUBA_GENERIC_METRICS,
    SENTRY_SLICING_CONFIG,
    SENTRY_SLICING_LOGICAL_PARTITION_COUNT,
    SLICED_KAFKA_TOPICS,
)
from sentry.sentry_metrics.consumers.indexer.routing_producer import RoutingPayload
from sentry.sentry_metrics.consumers.indexer.slicing_router import (
    MissingOrgInRoutingHeader,
    SlicingConfigurationException,
    SlicingRouter,
    _validate_slicing_config,
    _validate_slicing_consumer_config,
)


@pytest.fixture
def metrics_message(org_id: int) -> Message[RoutingPayload]:
    return Message(
        BrokerValue(
            payload=RoutingPayload(
                routing_header={"org_id": org_id},
                routing_message=KafkaPayload(
                    key=b"",
                    value=b"{}",
                    headers=[],
                ),
            ),
            partition=Partition(Topic("source_topic"), 0),
            offset=0,
            timestamp=datetime.now(),
        )
    )


@pytest.fixture
def setup_slicing(monkeypatch) -> None:
    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "sliceable", {(0, 128): 0, (128, 256): 1}  # type: ignore
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPICS,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 0),
        {"topic": "sliced_topic_0", "cluster": "sliceable_0"},
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPICS,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 1),
        {"topic": "sliced_topic_1", "cluster": "sliceable_1"},
    )
    monkeypatch.setitem(
        KAFKA_CLUSTERS,
        "sliceable_0",
        {"bootstrap.servers": "127.0.0.1:9092"},
    )
    monkeypatch.setitem(
        KAFKA_CLUSTERS,
        "sliceable_1",
        {"bootstrap.servers": "127.0.0.1:9092"},
    )


@pytest.mark.parametrize("org_id", [1, 127, 128, 256, 257])
def test_with_slicing(metrics_message, setup_slicing) -> None:
    """
    With partitioning settings, the SlicingRouter should route to the correct topic
    based on the org_id header.
    """
    org_id = metrics_message.payload.routing_header.get("org_id")
    router = SlicingRouter("sliceable")
    route = router.get_route_for_message(metrics_message)
    if int(org_id) % SENTRY_SLICING_LOGICAL_PARTITION_COUNT < 128:
        assert route.topic.name == "sliced_topic_0"
    elif int(org_id) % SENTRY_SLICING_LOGICAL_PARTITION_COUNT < 256:
        assert route.topic.name == "sliced_topic_1"
    else:
        assert False, "unexpected org_id"


def test_with_no_org_in_routing_header(setup_slicing) -> None:
    """
    With partitioning settings, the SlicingRouter should route to the correct topic
    based on the org_id header.
    """
    message = Message(
        BrokerValue(
            payload=RoutingPayload(
                routing_header={},
                routing_message=KafkaPayload(
                    key=b"",
                    value=b"{}",
                    headers=[],
                ),
            ),
            partition=Partition(Topic("source_topic"), 0),
            offset=0,
            timestamp=datetime.now(),
        )
    )
    assert message.payload.routing_header.get("org_id") is None
    router = SlicingRouter("sliceable")
    with pytest.raises(MissingOrgInRoutingHeader):
        _ = router.get_route_for_message(message)


@pytest.mark.parametrize("org_id", [100])
def test_with_misconfiguration(metrics_message, monkeypatch):
    """
    Configuring topic override only does not kick in routing logic. So the
    messages should be routed to the logical topic.
    """
    monkeypatch.setitem(
        SLICED_KAFKA_TOPICS,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 0),
        {"topic": "sliced_topic_0"},
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPICS,  # type: ignore
        (KAFKA_SNUBA_GENERIC_METRICS, 1),
        {"topic": "sliced_topic_1"},
    )

    with pytest.raises(SlicingConfigurationException):
        _ = SlicingRouter("sliceable")


def test_validate_slicing_consumer_config(monkeypatch) -> None:
    """
    Validate that the slicing consumer config is valid.
    """
    with pytest.raises(
        SlicingConfigurationException, match=r"not defined in settings.SENTRY_SLICING_CONFIG"
    ):
        _validate_slicing_consumer_config("sliceable")

    # Let the check for slicing config pass
    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "sliceable", {(0, 128): 0, (128, 256): 1}  # type: ignore
    )

    # Create the sliced kafka topics but omit defining the broker config in
    # KAFKA_CLUSTERS
    monkeypatch.setitem(
        SLICED_KAFKA_TOPICS,  # type: ignore
        ("sliceable", 0),
        {"topic": "sliced_topic_0", "cluster": "sliceable_0"},
    )
    monkeypatch.setitem(
        SLICED_KAFKA_TOPICS,  # type: ignore
        ("sliceable", 1),
        {"topic": "sliced_topic_1", "cluster": "sliceable_1"},
    )
    monkeypatch.setitem(
        KAFKA_CLUSTERS,  # type: ignore
        "sliceable_0",
        {"bootstrap.servers": "127.0.0.1:9092"},
    )
    with pytest.raises(SlicingConfigurationException, match=r"Broker configuration missing"):
        _validate_slicing_consumer_config("sliceable")

    # Now add the broker config for the second slice
    monkeypatch.setitem(
        KAFKA_CLUSTERS,  # type: ignore
        "sliceable_1",
        {"bootstrap.servers": "127.0.0.1:9092"},
    )

    try:
        _validate_slicing_consumer_config("sliceable")
    except SlicingConfigurationException as e:
        assert False, f"Should not raise exception: {e}"


def test_validate_slicing_config(monkeypatch) -> None:
    # Valid setup(s)
    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "sliceable", {(0, 128): 0, (128, 256): 1}  # type: ignore
    )
    _validate_slicing_config()

    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "sliceable", {(0, 64): 0, (64, 66): 1, (66, 100): 0, (100, 256): 1}  # type: ignore
    )
    _validate_slicing_config()

    # Assign a given logical partition to two slices
    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "sliceable", {(0, 129): 0, (128, 256): 1}  # type: ignore
    )
    with pytest.raises(
        SlicingConfigurationException,
        match=r"'sliceable' has two assignments to logical partition 128",
    ):
        _validate_slicing_config()

    # Fail to assign a logical partition to a slice
    monkeypatch.setitem(
        SENTRY_SLICING_CONFIG, "sliceable", {(0, 127): 0, (128, 256): 1}  # type: ignore
    )
    with pytest.raises(
        SlicingConfigurationException,
        match=r"'sliceable' is missing logical partition assignments: \{127\}",
    ):
        _validate_slicing_config()

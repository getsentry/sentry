import uuid
from datetime import UTC, datetime
from unittest import mock

import pytest
from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition
from arroyo.types import Topic as ArroyoTopic
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.telemetry_classifiers.eap.producer import (
    ENRICHMENT_NAMESPACE,
    produce_enrichment_attributes,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition

WRITE_ENABLED_OPTION = "telemetry-classifiers.eap-write.enabled"


class ProduceEnrichmentAttributesTest(TestCase):
    def _produce(
        self,
        *,
        retention_days: int = 45,
        client_sample_rate: float = 1.0,
        server_sample_rate: float = 1.0,
    ) -> tuple[TraceItem, KafkaPayload]:
        storage = MemoryMessageStorage[KafkaPayload]()
        broker = LocalBroker(storage)
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        broker.create_topic(topic, partitions=1)
        broker_producer = broker.get_producer()
        local_producer = mock.Mock()
        local_producer.produce.side_effect = broker_producer.produce
        local_producer.close.side_effect = broker_producer.close
        local_producer.get_config.return_value = {}
        producer = FutureTrackingProducer(
            name=f"test.telemetry-classifiers.{id(broker)}",
            producer_factory=mock.Mock(return_value=local_producer),
            should_backpressure=False,
        )

        with (
            override_options({WRITE_ENABLED_OPTION: True}),
            mock.patch("sentry.telemetry_classifiers.eap.producer._snuba_items_producer", producer),
            mock.patch(
                "sentry.telemetry_classifiers.eap.producer.timezone.now",
                return_value=datetime(2020, 1, 2, tzinfo=UTC),
            ),
        ):
            produce_enrichment_attributes(
                self.project,
                idempotency_key="classifier:conversation:version",
                trace_id="1" * 32,
                timestamp=datetime(2020, 1, 1, tzinfo=UTC),
                retention_days=retention_days,
                attributes={"sentry.enrichment.test": 0.75},
                conversation_id="conversation-id",
                client_sample_rate=client_sample_rate,
                server_sample_rate=server_sample_rate,
            )

        message = broker.consume(Partition(topic, 0), 0)
        assert message is not None
        return get_topic_codec(Topic.SNUBA_ITEMS).decode(message.payload.value), message.payload

    def test_produces_enrichment_attributes(self) -> None:
        trace_item, payload = self._produce()

        assert trace_item.organization_id == self.organization.id
        assert trace_item.project_id == self.project.id
        assert trace_item.item_type == TraceItemType.TRACE_ITEM_TYPE_ENRICHMENT_ATTRIBUTES
        assert trace_item.trace_id == "1" * 32
        assert trace_item.conversation_id == "conversation-id"
        assert trace_item.timestamp.ToDatetime(tzinfo=UTC) == datetime(2020, 1, 1, tzinfo=UTC)
        assert trace_item.received.ToDatetime(tzinfo=UTC) == datetime(2020, 1, 2, tzinfo=UTC)
        assert trace_item.retention_days == 45
        assert trace_item.downsampled_retention_days == 45
        assert trace_item.client_sample_rate == 1.0
        assert trace_item.server_sample_rate == 1.0
        assert trace_item.attributes["sentry.enrichment.test"].double_value == 0.75
        expected_id = uuid.uuid5(
            ENRICHMENT_NAMESPACE,
            f"{self.organization.id}:{self.project.id}:classifier:conversation:version",
        )
        assert trace_item.item_id == hex_to_item_id(expected_id.hex)
        assert payload.key is None
        assert payload.headers == [
            ("item_type", str(TraceItemType.TRACE_ITEM_TYPE_ENRICHMENT_ATTRIBUTES).encode("ascii")),
            ("project_id", str(self.project.id).encode("ascii")),
        ]

    def test_uses_configured_sample_rates(self) -> None:
        trace_item, _ = self._produce(client_sample_rate=0.5, server_sample_rate=0.25)

        assert trace_item.client_sample_rate == 0.5
        assert trace_item.server_sample_rate == 0.25

    def test_rejects_invalid_sample_rate(self) -> None:
        with (
            override_options({WRITE_ENABLED_OPTION: True}),
            pytest.raises(
                ValueError, match="client_sample_rate must be greater than 0 and at most 1"
            ),
        ):
            produce_enrichment_attributes(
                self.project,
                idempotency_key="key",
                trace_id="1" * 32,
                timestamp=datetime(2020, 1, 1, tzinfo=UTC),
                retention_days=30,
                attributes={"sentry.enrichment.test": True},
                client_sample_rate=0.0,
            )

    @mock.patch("sentry.telemetry_classifiers.eap.producer._snuba_items_producer")
    def test_writes_disabled_by_default(self, producer: mock.Mock) -> None:
        produce_enrichment_attributes(
            self.project,
            idempotency_key="key",
            trace_id="1" * 32,
            timestamp=datetime(2020, 1, 1, tzinfo=UTC),
            retention_days=30,
            attributes={"sentry.enrichment.test": True},
        )

        producer.produce.assert_not_called()

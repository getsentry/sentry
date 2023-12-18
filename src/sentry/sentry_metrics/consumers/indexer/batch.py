import logging
import random
from collections import defaultdict
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    Mapping,
    MutableMapping,
    MutableSequence,
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
    cast,
)

import rapidjson
import sentry_sdk
from arroyo.backends.kafka import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message
from django.conf import settings
from sentry_kafka_schemas.codecs import ValidationError
from sentry_kafka_schemas.schema_types.ingest_metrics_v1 import IngestMetric
from sentry_kafka_schemas.schema_types.snuba_generic_metrics_v1 import GenericMetric
from sentry_kafka_schemas.schema_types.snuba_metrics_v1 import Metric

from sentry import options
from sentry.sentry_metrics.aggregation_option_registry import get_aggregation_option
from sentry.sentry_metrics.configuration import MAX_INDEXED_COLUMN_LENGTH
from sentry.sentry_metrics.consumers.indexer.common import (
    BrokerMeta,
    IndexerOutputMessageBatch,
    MessageBatch,
)
from sentry.sentry_metrics.consumers.indexer.parsed_message import ParsedMessage
from sentry.sentry_metrics.consumers.indexer.routing_producer import RoutingPayload
from sentry.sentry_metrics.indexer.base import Metadata
from sentry.sentry_metrics.use_case_id_registry import UseCaseID, extract_use_case_id
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

# Do not change these values without also changing the corresponding MAX_INDEXED_COLUMN_LENGTH to
# ensure that the database can store the data.
MAX_NAME_LENGTH = MAX_INDEXED_COLUMN_LENGTH

ACCEPTED_METRIC_TYPES = {"s", "c", "d", "g"}  # set, counter, distribution, gauge

OrgId = int
Headers = MutableSequence[Tuple[str, bytes]]


def valid_metric_name(name: Optional[str]) -> bool:
    if name is None:
        return False
    if len(name) > MAX_NAME_LENGTH:
        return False

    return True


def _should_sample_debug_log() -> bool:
    rate: float = settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE
    return (rate > 0) and random.random() <= rate


class IndexerBatch:
    def __init__(
        self,
        outer_message: Message[MessageBatch],
        should_index_tag_values: bool,
        is_output_sliced: bool,
        tags_validator: Callable[[Mapping[str, str]], bool],
        schema_validator: Callable[[str, IngestMetric], None],
    ) -> None:
        self.outer_message = outer_message
        self.__should_index_tag_values = should_index_tag_values
        self.is_output_sliced = is_output_sliced
        self.tags_validator = tags_validator
        self.schema_validator = schema_validator

        self.__message_count: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_bytes: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_tags_len: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_value_len: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_bytes_max: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_tags_len_max: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_value_len_max: MutableMapping[UseCaseID, int] = defaultdict(int)

        # Invalid messages and filtered messages are both skipped during processing
        # (reconstruct_messages), but we want to put the invalid messages into the
        # DLQ while discarding the filtered messages
        self.invalid_msg_meta: Set[BrokerMeta] = set()
        self.filtered_msg_meta: Set[BrokerMeta] = set()
        self.parsed_payloads_by_meta: MutableMapping[BrokerMeta, ParsedMessage] = {}

        self._extract_messages()

    @metrics.wraps("process_messages.extract_messages")
    def _extract_messages(self) -> None:
        """
        For each messages:
        1. Check the header to see if the use case ID is disabled
        2. Parse the raw bytes into ParsedMessage (_extract_message)
        3. Semantically validate the content of ParsedMessage (_validate_message)

        We track the offset and partition of the message that are filtered or
        invalid so later we can:
        - Produce the invalid messages to DLQ
        - Skip those filtered/invalid message from the indexing phase
        (extract_strings and reconstruct_messages)
        """
        skipped_msgs_cnt: MutableMapping[str, int] = defaultdict(int)

        for msg in self.outer_message.payload:
            assert isinstance(msg.value, BrokerValue)
            broker_meta = BrokerMeta(msg.value.partition, msg.value.offset)

            if (namespace := self._extract_namespace(msg.payload.headers)) in options.get(
                "sentry-metrics.indexer.disabled-namespaces"
            ):
                assert namespace
                skipped_msgs_cnt[namespace] += 1
                self.filtered_msg_meta.add(broker_meta)
                continue

            try:
                parsed_payload = self._extract_message(msg)
                self._validate_message(parsed_payload)
                self.parsed_payloads_by_meta[broker_meta] = parsed_payload
            except Exception as e:
                self.invalid_msg_meta.add(broker_meta)
                logger.exception(
                    str(e),
                    extra={"payload_value": str(msg.payload.value)},
                )

        for namespace, cnt in skipped_msgs_cnt.items():
            metrics.incr(
                "process_messages.namespace_disabled",
                amount=cnt,
                tags={"namespace": namespace},
            )

    def _extract_message(
        self,
        msg: Message[KafkaPayload],
    ) -> ParsedMessage:
        assert isinstance(msg.value, BrokerValue)
        try:
            parsed_payload: ParsedMessage = json.loads(
                msg.payload.value.decode("utf-8"), use_rapid_json=True
            )
        except rapidjson.JSONDecodeError:
            logger.exception(
                "process_messages.invalid_json",
                extra={"payload_value": str(msg.payload.value)},
            )
            raise

        assert parsed_payload.get("name", None) is not None
        parsed_payload["use_case_id"] = use_case_id = extract_use_case_id(parsed_payload["name"])

        try:
            self.schema_validator(use_case_id.value, parsed_payload)
        except ValidationError:
            if settings.SENTRY_METRICS_INDEXER_RAISE_VALIDATION_ERRORS:
                raise
            logger.warning(
                "process_messages.invalid_schema",
                extra={"payload_value": str(msg.payload.value)},
                exc_info=True,
            )

        self.__message_count[use_case_id] += 1

        self.__message_bytes[use_case_id] += len(msg.payload.value)
        self.__message_tags_len[use_case_id] += len(parsed_payload.get("tags", {}))
        self.__message_value_len[use_case_id] += (
            len(parsed_payload["value"]) if isinstance(parsed_payload["value"], Iterable) else 1
        )
        self.__message_bytes_max[use_case_id] = max(
            len(msg.payload.value), self.__message_bytes_max[use_case_id]
        )
        self.__message_tags_len_max[use_case_id] = max(
            len(parsed_payload.get("tags", {})), self.__message_tags_len_max[use_case_id]
        )
        self.__message_value_len_max[use_case_id] = max(
            len(parsed_payload["value"]) if isinstance(parsed_payload["value"], Iterable) else 1,
            self.__message_value_len_max[use_case_id],
        )

        return parsed_payload

    def _extract_namespace(self, headers: Headers) -> Optional[str]:
        for string, endcoded in headers:
            if string == "namespace":
                return endcoded.decode("utf-8")
        metrics.incr("sentry-metrics.indexer.killswitch.no-namespace-in-header")
        return None

    def _validate_message(self, parsed_payload: ParsedMessage) -> None:
        metric_name = parsed_payload["name"]
        metric_type = parsed_payload["type"]
        use_case_id = parsed_payload["use_case_id"]
        org_id = parsed_payload["org_id"]
        tags = parsed_payload.get("tags", {})

        if not valid_metric_name(metric_name):
            logger.error(
                "process_messages.invalid_metric_name",
                extra={
                    "use_case_id": use_case_id,
                    "org_id": org_id,
                    "metric_name": metric_name,
                },
            )
            raise ValueError(f"Invalid metric name: {metric_name}")

        if metric_type not in ACCEPTED_METRIC_TYPES:
            logger.error(
                "process_messages.invalid_metric_type",
                extra={
                    "use_case_id": use_case_id,
                    "org_id": org_id,
                    "metric_type": metric_type,
                },
            )
            raise ValueError(f"Invalid metric type: {metric_type}")

        if self.tags_validator(tags) is False:
            # sentry doesn't seem to actually capture nested logger.error extra args
            sentry_sdk.set_extra("all_metric_tags", tags)
            logger.error(
                "process_messages.invalid_tags",
                extra={
                    "use_case_id": use_case_id,
                    "org_id": org_id,
                    "metric_name": metric_name,
                    "tags": tags,
                },
            )
            raise ValueError(f"Invalid metric tags: {tags}")

    @metrics.wraps("process_messages.filter_messages")
    def filter_messages(self, keys_to_remove: Sequence[BrokerMeta]) -> None:
        # XXX: it is useful to be able to get a sample of organization ids that are affected by rate limits, but this is really slow.
        for broker_meta in keys_to_remove:
            if _should_sample_debug_log():
                sentry_sdk.set_tag(
                    "sentry_metrics.organization_id",
                    self.parsed_payloads_by_meta[broker_meta]["org_id"],
                )
                sentry_sdk.set_tag(
                    "sentry_metrics.metric_name", self.parsed_payloads_by_meta[broker_meta]["name"]
                )
                logger.error(
                    "process_messages.dropped_message",
                    extra={
                        "reason": "cardinality_limit",
                    },
                )

        self.filtered_msg_meta.update(keys_to_remove)

    @metrics.wraps("process_messages.extract_strings")
    def extract_strings(self) -> Mapping[UseCaseID, Mapping[OrgId, Set[str]]]:
        strings: Mapping[UseCaseID, Mapping[OrgId, Set[str]]] = defaultdict(
            lambda: defaultdict(set)
        )

        for broker_meta, message in self.parsed_payloads_by_meta.items():
            if broker_meta in self.invalid_msg_meta or broker_meta in self.filtered_msg_meta:
                continue

            metric_name = message["name"]
            use_case_id = message["use_case_id"]
            org_id = message["org_id"]
            tags = message.get("tags", {})

            strings_in_message = {
                metric_name,
                *tags.keys(),
            }

            if self.__should_index_tag_values:
                strings_in_message.update(tags.values())

            strings[use_case_id][org_id].update(strings_in_message)

        for use_case_id, org_mapping in strings.items():
            metrics.gauge(
                "process_messages.lookups_per_batch",
                value=sum(len(parsed_strings) for parsed_strings in org_mapping.values()),
                tags={"use_case": use_case_id.value},
            )

        return strings

    @metrics.wraps("process_messages.reconstruct_messages")
    def reconstruct_messages(
        self,
        mapping: Mapping[UseCaseID, Mapping[OrgId, Mapping[str, Optional[int]]]],
        bulk_record_meta: Mapping[UseCaseID, Mapping[OrgId, Mapping[str, Metadata]]],
    ) -> IndexerOutputMessageBatch:
        new_messages: MutableSequence[
            Message[Union[RoutingPayload, KafkaPayload, InvalidMessage]]
        ] = []
        cogs_usage: MutableMapping[UseCaseID, int] = defaultdict(int)

        for message in self.outer_message.payload:
            used_tags: Set[str] = set()
            output_message_meta: Dict[str, Dict[str, str]] = defaultdict(dict)
            assert isinstance(message.value, BrokerValue)
            broker_meta = BrokerMeta(message.value.partition, message.value.offset)
            if broker_meta in self.filtered_msg_meta:
                continue
            if broker_meta in self.invalid_msg_meta:
                new_messages.append(
                    Message(
                        message.value.replace(
                            InvalidMessage(broker_meta.partition, broker_meta.offset)
                        )
                    )
                )
                continue
            old_payload_value = self.parsed_payloads_by_meta.pop(broker_meta)

            metric_name = old_payload_value["name"]
            org_id = old_payload_value["org_id"]
            use_case_id = old_payload_value["use_case_id"]
            cogs_usage[use_case_id] += 1
            sentry_sdk.set_tag("sentry_metrics.organization_id", org_id)
            tags = old_payload_value.get("tags", {})
            used_tags.add(metric_name)

            new_tags: Dict[str, Union[str, int]] = {}
            exceeded_global_quotas = 0
            exceeded_org_quotas = 0

            with metrics.timer("metrics_consumer.reconstruct_messages.get_indexed_tags"):
                try:
                    for k, v in tags.items():
                        used_tags.update({k, v})
                        new_k = mapping[use_case_id][org_id][k]
                        if new_k is None:
                            metadata = bulk_record_meta[use_case_id][org_id].get(k)
                            if (
                                metadata
                                and metadata.fetch_type_ext
                                and metadata.fetch_type_ext.is_global
                            ):
                                exceeded_global_quotas += 1
                            else:
                                exceeded_org_quotas += 1
                            continue

                        value_to_write: Union[int, str] = v
                        if self.__should_index_tag_values:
                            new_v = mapping[use_case_id][org_id][v]
                            if new_v is None:
                                metadata = bulk_record_meta[use_case_id][org_id].get(v)
                                if (
                                    metadata
                                    and metadata.fetch_type_ext
                                    and metadata.fetch_type_ext.is_global
                                ):
                                    exceeded_global_quotas += 1
                                else:
                                    exceeded_org_quotas += 1
                                continue
                            else:
                                value_to_write = new_v

                        new_tags[str(new_k)] = value_to_write
                except KeyError:
                    logger.exception("process_messages.key_error", extra={"tags": tags})
                    continue

            if exceeded_org_quotas or exceeded_global_quotas:
                metrics.incr(
                    "sentry_metrics.indexer.process_messages.dropped_message",
                    tags={
                        "reason": "writes_limit",
                        "string_type": "tags",
                        "use_case_id": use_case_id.value,
                    },
                )
                if _should_sample_debug_log():
                    logger.error(
                        "process_messages.dropped_message",
                        extra={
                            "reason": "writes_limit",
                            "string_type": "tags",
                            "num_global_quotas": exceeded_global_quotas,
                            "num_org_quotas": exceeded_org_quotas,
                            "org_batch_size": len(mapping[use_case_id][org_id]),
                            "use_case_id": use_case_id.value,
                        },
                    )
                continue

            fetch_types_encountered = set()
            for tag in used_tags:
                if tag in bulk_record_meta[use_case_id][org_id]:
                    metadata = bulk_record_meta[use_case_id][org_id][tag]
                    fetch_types_encountered.add(metadata.fetch_type)
                    output_message_meta[metadata.fetch_type.value][str(metadata.id)] = tag

            mapping_header_content = bytes(
                "".join(sorted(t.value for t in fetch_types_encountered)), "utf-8"
            )

            numeric_metric_id = mapping[use_case_id][org_id][metric_name]
            if numeric_metric_id is None:
                metadata = bulk_record_meta[use_case_id][org_id].get(metric_name)
                metrics.incr(
                    "sentry_metrics.indexer.process_messages.dropped_message",
                    tags={
                        "reason": "missing_numeric_metric_id",
                        "string_type": "metric_id",
                        "use_case_id": use_case_id.value,
                    },
                )

                if _should_sample_debug_log():
                    logger.error(
                        "process_messages.dropped_message",
                        extra={
                            "string_type": "metric_id",
                            "is_global_quota": bool(
                                metadata
                                and metadata.fetch_type_ext
                                and metadata.fetch_type_ext.is_global
                            ),
                            "org_batch_size": len(mapping[use_case_id][org_id]),
                            "use_case_id": use_case_id.value,
                        },
                    )
                continue

            new_payload_value: Mapping[str, Any]

            # timestamp when the message was produced to ingest-* topic,
            # used for end-to-end latency metrics
            sentry_received_timestamp = message.value.timestamp.timestamp()

            with metrics.timer("metrics_consumer.reconstruct_messages.build_new_payload"):
                if self.__should_index_tag_values:
                    # Metrics don't support gauges (which use dicts), so assert value type
                    value = old_payload_value["value"]
                    assert isinstance(value, (int, float, list))
                    new_payload_v1: Metric = {
                        "tags": new_tags,
                        # XXX: relay actually sends this value unconditionally
                        "retention_days": old_payload_value.get("retention_days", 90),
                        "mapping_meta": output_message_meta,
                        "use_case_id": old_payload_value["use_case_id"].value,
                        "metric_id": numeric_metric_id,
                        "org_id": old_payload_value["org_id"],
                        "timestamp": old_payload_value["timestamp"],
                        "project_id": old_payload_value["project_id"],
                        "type": old_payload_value["type"],
                        "value": value,
                        "sentry_received_timestamp": sentry_received_timestamp,
                    }

                    new_payload_value = new_payload_v1
                else:
                    # When sending tag values as strings, set the version on the payload
                    # to 2. This is used by the consumer to determine how to decode the
                    # tag values.
                    new_payload_v2: GenericMetric = {
                        "tags": cast(Dict[str, str], new_tags),
                        "version": 2,
                        "retention_days": old_payload_value.get("retention_days", 90),
                        "mapping_meta": output_message_meta,
                        "use_case_id": old_payload_value["use_case_id"].value,
                        "metric_id": numeric_metric_id,
                        "org_id": old_payload_value["org_id"],
                        "timestamp": old_payload_value["timestamp"],
                        "project_id": old_payload_value["project_id"],
                        "type": old_payload_value["type"],
                        "value": old_payload_value["value"],
                        "sentry_received_timestamp": sentry_received_timestamp,
                    }
                    if aggregation_option := get_aggregation_option(old_payload_value["name"]):
                        new_payload_v2["aggregation_option"] = aggregation_option.value

                    new_payload_value = new_payload_v2

                with metrics.timer(
                    "metrics_consumer.reconstruct_messages.build_new_payload.json_step"
                ):
                    kafka_payload = KafkaPayload(
                        key=message.payload.key,
                        value=rapidjson.dumps(new_payload_value).encode(),
                        headers=[
                            *message.payload.headers,
                            ("mapping_sources", mapping_header_content),
                            # XXX: type mismatch, but seems to work fine in prod
                            ("metric_type", new_payload_value["type"]),  # type: ignore
                        ],
                    )
                if self.is_output_sliced:
                    routing_payload = RoutingPayload(
                        routing_header={"org_id": org_id},
                        routing_message=kafka_payload,
                    )
                    new_messages.append(Message(message.value.replace(routing_payload)))
                else:
                    new_messages.append(Message(message.value.replace(kafka_payload)))

        with metrics.timer("metrics_consumer.reconstruct_messages.emit_payload_metrics"):
            for use_case_id in self.__message_count:
                metrics.incr(
                    "metrics_consumer.process_message.messages_seen",
                    amount=self.__message_count[use_case_id],
                    tags={"use_case_id": use_case_id.value},
                )
                metrics.distribution(
                    "metrics_consumer.process_message.message.avg_size_in_batch",
                    self.__message_bytes[use_case_id] / self.__message_count[use_case_id],
                    tags={"use_case_id": use_case_id.value},
                    unit="byte",
                )
                metrics.distribution(
                    "metrics_consumer.process_message.message.avg_tags_len_in_batch",
                    self.__message_tags_len[use_case_id] / self.__message_count[use_case_id],
                    tags={"use_case_id": use_case_id.value},
                    unit="int",
                )
                metrics.distribution(
                    "metrics_consumer.process_message.message.avg_value_len_in_batch",
                    self.__message_value_len[use_case_id] / self.__message_count[use_case_id],
                    tags={"use_case_id": use_case_id.value},
                    unit="int",
                )
                metrics.gauge(
                    "metrics_consumer.process_message.message.max_size_in_batch",
                    self.__message_bytes_max[use_case_id],
                    tags={"use_case_id": use_case_id.value},
                    unit="byte",
                )
                metrics.gauge(
                    "metrics_consumer.process_message.message.max_tags_len_in_batch",
                    self.__message_tags_len_max[use_case_id],
                    tags={"use_case_id": use_case_id.value},
                    unit="int",
                )
                metrics.gauge(
                    "metrics_consumer.process_message.message.max_value_len_in_batch",
                    self.__message_value_len_max[use_case_id],
                    tags={"use_case_id": use_case_id.value},
                    unit="int",
                )
            num_messages = sum(self.__message_count.values())
            metrics.gauge(
                "metrics_consumer.process_message.message.avg_size_in_batch",
                sum(self.__message_bytes.values()) / num_messages,
            )
            metrics.gauge(
                "metrics_consumer.process_message.message.avg_tags_len_in_batch",
                sum(self.__message_tags_len.values()) / num_messages,
            )
            metrics.gauge(
                "metrics_consumer.process_message.message.avg_value_len_in_batch",
                sum(self.__message_value_len.values()) / num_messages,
            )

        return IndexerOutputMessageBatch(
            new_messages,
            cogs_usage,
        )

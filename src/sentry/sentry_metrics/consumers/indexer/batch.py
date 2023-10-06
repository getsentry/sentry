import logging
import random
from collections import defaultdict
from typing import (
    Any,
    Callable,
    Dict,
    Mapping,
    MutableMapping,
    MutableSequence,
    NamedTuple,
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
from arroyo.types import BrokerValue, Message
from django.conf import settings
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_metrics_v1 import IngestMetric
from sentry_kafka_schemas.schema_types.snuba_generic_metrics_v1 import GenericMetric
from sentry_kafka_schemas.schema_types.snuba_metrics_v1 import Metric

from sentry import options
from sentry.sentry_metrics.aggregation_option_registry import get_aggregation_option
from sentry.sentry_metrics.configuration import MAX_INDEXED_COLUMN_LENGTH
from sentry.sentry_metrics.consumers.indexer.common import IndexerOutputMessageBatch, MessageBatch
from sentry.sentry_metrics.consumers.indexer.parsed_message import ParsedMessage
from sentry.sentry_metrics.consumers.indexer.routing_producer import RoutingPayload
from sentry.sentry_metrics.indexer.base import Metadata
from sentry.sentry_metrics.use_case_id_registry import UseCaseID, extract_use_case_id
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

# Do not change these values without also changing the corresponding MAX_INDEXED_COLUMN_LENGTH to
# ensure that the database can store the data.
MAX_NAME_LENGTH = MAX_INDEXED_COLUMN_LENGTH

ACCEPTED_METRIC_TYPES = {"s", "c", "d"}  # set, counter, distribution

OrgId = int
Headers = MutableSequence[Tuple[str, bytes]]


class PartitionIdxOffset(NamedTuple):
    partition_idx: int
    offset: int


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
        input_codec: Optional[Codec[Any]],
        tags_validator: Callable[[Mapping[str, str]], bool],
    ) -> None:
        self.outer_message = outer_message
        self.__should_index_tag_values = should_index_tag_values
        self.is_output_sliced = is_output_sliced
        self.__input_codec = input_codec
        self.tags_validator = tags_validator

        self.__message_count: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_size_sum: MutableMapping[UseCaseID, int] = defaultdict(int)
        self.__message_size_max: MutableMapping[UseCaseID, int] = defaultdict(int)

        self._extract_messages()

    def _extract_namespace(self, headers: Headers) -> Optional[str]:
        for string, endcoded in headers:
            if string == "namespace":
                return endcoded.decode("utf-8")
        metrics.incr("sentry-metrics.indexer.killswitch.no-namespace-in-header")
        return None

    @metrics.wraps("process_messages.extract_messages")
    def _extract_messages(self) -> None:
        self.skipped_offsets: Set[PartitionIdxOffset] = set()
        self.parsed_payloads_by_offset: MutableMapping[PartitionIdxOffset, ParsedMessage] = {}

        disabled_msgs_cnt: MutableMapping[str, int] = defaultdict(int)

        for msg in self.outer_message.payload:
            assert isinstance(msg.value, BrokerValue)
            partition_offset = PartitionIdxOffset(msg.value.partition.index, msg.value.offset)

            if (namespace := self._extract_namespace(msg.payload.headers)) in options.get(
                "sentry-metrics.indexer.disabled-namespaces"
            ):
                assert namespace
                self.skipped_offsets.add(partition_offset)
                disabled_msgs_cnt[namespace] += 1
                continue
            try:
                parsed_payload: ParsedMessage = json.loads(
                    msg.payload.value.decode("utf-8"), use_rapid_json=True
                )
            except rapidjson.JSONDecodeError:
                self.skipped_offsets.add(partition_offset)
                logger.error(
                    "process_messages.invalid_json",
                    extra={"payload_value": str(msg.payload.value)},
                    exc_info=True,
                )
                continue
            try:
                if self.__input_codec:
                    self.__input_codec.validate(parsed_payload)
            except ValidationError:
                if settings.SENTRY_METRICS_INDEXER_RAISE_VALIDATION_ERRORS:
                    raise

                # For now while this is still experimental, those errors are
                # not supposed to be fatal.
                logger.warning(
                    "process_messages.invalid_schema",
                    extra={"payload_value": str(msg.payload.value)},
                    exc_info=True,
                )

            try:
                parsed_payload["use_case_id"] = use_case_id = extract_use_case_id(
                    parsed_payload["name"]
                )
            except ValidationError:
                self.skipped_offsets.add(partition_offset)
                logger.error(
                    "process_messages.invalid_metric_resource_identifier",
                    extra={"payload_value": str(msg.payload.value)},
                    exc_info=True,
                )
                continue

            self.__message_count[use_case_id] += 1
            self.__message_size_max[use_case_id] = max(
                len(msg.payload.value), self.__message_size_max[use_case_id]
            )
            self.__message_size_sum[use_case_id] += len(msg.payload.value)

            # Ensure that the parsed_payload can be cast back to to
            # IngestMetric. If there are any schema changes, this check would
            # fail and ParsedMessage needs to be adjusted to be a superset of
            # IngestMetric again.
            _: IngestMetric = parsed_payload

            self.parsed_payloads_by_offset[partition_offset] = parsed_payload

        for namespace, cnt in disabled_msgs_cnt.items():
            metrics.incr(
                "process_messages.namespace_disabled",
                amount=cnt,
                tags={"namespace": namespace},
            )

    @metrics.wraps("process_messages.filter_messages")
    def filter_messages(self, keys_to_remove: Sequence[PartitionIdxOffset]) -> None:
        # XXX: it is useful to be able to get a sample of organization ids that are affected by rate limits, but this is really slow.
        for offset in keys_to_remove:
            if _should_sample_debug_log():
                sentry_sdk.set_tag(
                    "sentry_metrics.organization_id",
                    self.parsed_payloads_by_offset[offset]["org_id"],
                )
                sentry_sdk.set_tag(
                    "sentry_metrics.metric_name", self.parsed_payloads_by_offset[offset]["name"]
                )
                logger.error(
                    "process_messages.dropped_message",
                    extra={
                        "reason": "cardinality_limit",
                    },
                )

        self.skipped_offsets.update(keys_to_remove)

    @metrics.wraps("process_messages.extract_strings")
    def extract_strings(self) -> Mapping[UseCaseID, Mapping[OrgId, Set[str]]]:
        strings: Mapping[UseCaseID, Mapping[OrgId, Set[str]]] = defaultdict(
            lambda: defaultdict(set)
        )

        for partition_offset, message in self.parsed_payloads_by_offset.items():
            if partition_offset in self.skipped_offsets:
                continue

            partition_idx, offset = partition_offset

            metric_name = message["name"]
            metric_type = message["type"]
            use_case_id = message["use_case_id"]
            org_id = message["org_id"]
            tags = message.get("tags", {})

            if not valid_metric_name(metric_name):
                logger.error(
                    "process_messages.invalid_metric_name",
                    extra={
                        "use_case_id": use_case_id,
                        "org_id": org_id,
                        "metric_name": metric_name,
                        "partition": partition_idx,
                        "offset": offset,
                    },
                )
                self.skipped_offsets.add(partition_offset)
                continue

            if metric_type not in ACCEPTED_METRIC_TYPES:
                logger.error(
                    "process_messages.invalid_metric_type",
                    extra={
                        "use_case_id": use_case_id,
                        "org_id": org_id,
                        "metric_type": metric_type,
                        "offset": offset,
                    },
                )
                self.skipped_offsets.add(partition_offset)
                continue

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
                        "partition": partition_idx,
                        "offset": offset,
                    },
                )
                self.skipped_offsets.add(partition_offset)
                continue

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
        new_messages: IndexerOutputMessageBatch = []

        for message in self.outer_message.payload:
            used_tags: Set[str] = set()
            output_message_meta: Dict[str, Dict[str, str]] = defaultdict(dict)
            assert isinstance(message.value, BrokerValue)
            partition_offset = PartitionIdxOffset(
                message.value.partition.index, message.value.offset
            )
            if partition_offset in self.skipped_offsets:
                continue
            old_payload_value = self.parsed_payloads_by_offset.pop(partition_offset)

            metric_name = old_payload_value["name"]
            org_id = old_payload_value["org_id"]
            use_case_id = old_payload_value["use_case_id"]
            sentry_sdk.set_tag("sentry_metrics.organization_id", org_id)
            tags = old_payload_value.get("tags", {})
            used_tags.add(metric_name)

            new_tags: Dict[str, Union[str, int]] = {}
            exceeded_global_quotas = 0
            exceeded_org_quotas = 0

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
                logger.error("process_messages.key_error", extra={"tags": tags}, exc_info=True)
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

            if self.__should_index_tag_values:
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
                    "value": old_payload_value["value"],
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

        for use_case_id in self.__message_count:
            metrics.incr(
                "metrics_consumer.process_message.messages_seen",
                amount=self.__message_count[use_case_id],
                tags={"use_case_id": use_case_id.value},
            )
            metrics.timing(
                "metrics_consumer.process_message.message.size.avg",
                self.__message_size_sum[use_case_id] / self.__message_count[use_case_id],
                tags={"use_case_id": use_case_id.value},
            )
            metrics.timing(
                "metrics_consumer.process_message.message.size.max",
                self.__message_size_max[use_case_id],
                tags={"use_case_id": use_case_id.value},
            )
        return new_messages

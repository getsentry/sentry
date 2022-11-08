import logging
import random
from collections import defaultdict
from typing import (
    Any,
    List,
    Mapping,
    MutableMapping,
    NamedTuple,
    Optional,
    Sequence,
    Set,
    TypedDict,
    cast,
)

import rapidjson
import sentry_sdk
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message
from django.conf import settings

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.consumers.indexer.common import MessageBatch
from sentry.sentry_metrics.indexer.base import Metadata
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

MAX_NAME_LENGTH = 200
MAX_TAG_KEY_LENGTH = 200
MAX_TAG_VALUE_LENGTH = 200

ACCEPTED_METRIC_TYPES = {"s", "c", "d"}  # set, counter, distribution


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


def invalid_metric_tags(tags: Mapping[str, str]) -> Sequence[str]:
    invalid_strs: List[str] = []
    for key, value in tags.items():
        if key is None or len(key) > MAX_TAG_KEY_LENGTH:
            invalid_strs.append(key)
        if value is None or len(value) > MAX_TAG_VALUE_LENGTH:
            invalid_strs.append(value)

    return invalid_strs


class InboundMessage(TypedDict):
    # Note: This is only the subset of fields we access in this file.
    org_id: int
    name: str
    type: str
    tags: Mapping[str, str]


class IndexerBatch:
    def __init__(
        self,
        use_case_id: UseCaseKey,
        outer_message: Message[MessageBatch],
        should_index_tag_values: bool,
    ) -> None:
        self.use_case_id = use_case_id
        self.outer_message = outer_message
        self.__should_index_tag_values = should_index_tag_values

        self._extract_messages()

    @metrics.wraps("process_messages.extract_messages")
    def _extract_messages(self) -> None:
        self.skipped_offsets: Set[PartitionIdxOffset] = set()
        self.parsed_payloads_by_offset: MutableMapping[PartitionIdxOffset, InboundMessage] = {}

        for msg in self.outer_message.payload:
            partition_offset = PartitionIdxOffset(msg.partition.index, msg.offset)
            try:
                parsed_payload = json.loads(msg.payload.value.decode("utf-8"), use_rapid_json=True)
                self.parsed_payloads_by_offset[partition_offset] = parsed_payload
            except rapidjson.JSONDecodeError:
                self.skipped_offsets.add(partition_offset)
                logger.error(
                    "process_messages.invalid_json",
                    extra={"payload_value": str(msg.payload.value)},
                    exc_info=True,
                )
                continue

    @metrics.wraps("process_messages.filter_messages")
    def filter_messages(self, keys_to_remove: Sequence[PartitionIdxOffset]) -> None:
        metrics.incr(
            "sentry_metrics.indexer.process_messages.dropped_message",
            amount=len(keys_to_remove),
            tags={
                "reason": "cardinality_limit",
            },
        )

        # XXX: it is useful to be able to get a sample of organization ids that are affected by rate limits, but this is really slow.
        for offset in keys_to_remove:
            sentry_sdk.set_tag(
                "sentry_metrics.organization_id", self.parsed_payloads_by_offset[offset]["org_id"]
            )
            if _should_sample_debug_log():
                logger.error(
                    "process_messages.dropped_message",
                    extra={
                        "reason": "cardinality_limit",
                    },
                )

        self.skipped_offsets.update(keys_to_remove)

    @metrics.wraps("process_messages.extract_strings")
    def extract_strings(self) -> Mapping[int, Set[str]]:
        org_strings = defaultdict(set)

        for partition_offset, message in self.parsed_payloads_by_offset.items():
            if partition_offset in self.skipped_offsets:
                continue

            partition_idx, offset = partition_offset

            metric_name = message["name"]
            metric_type = message["type"]
            org_id = message["org_id"]
            tags = message.get("tags", {})

            if not valid_metric_name(metric_name):
                logger.error(
                    "process_messages.invalid_metric_name",
                    extra={
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
                    extra={"org_id": org_id, "metric_type": metric_type, "offset": offset},
                )
                self.skipped_offsets.add(partition_offset)
                continue

            invalid_strs = invalid_metric_tags(tags)

            if invalid_strs:
                # sentry doesn't seem to actually capture nested logger.error extra args
                sentry_sdk.set_extra("all_metric_tags", tags)
                logger.error(
                    "process_messages.invalid_tags",
                    extra={
                        "org_id": org_id,
                        "metric_name": metric_name,
                        "invalid_tags": invalid_strs,
                        "partition": partition_idx,
                        "offset": offset,
                    },
                )
                self.skipped_offsets.add(partition_offset)
                continue

            parsed_strings = {
                metric_name,
                *tags.keys(),
            }

            if self.__should_index_tag_values:
                parsed_strings.update(tags.values())

            org_strings[org_id].update(parsed_strings)

        string_count = 0
        for org_set in org_strings:
            string_count += len(org_strings[org_set])
        metrics.gauge("process_messages.lookups_per_batch", value=string_count)

        return org_strings

    @metrics.wraps("process_messages.reconstruct_messages")
    def reconstruct_messages(
        self,
        mapping: Mapping[int, Mapping[str, Optional[int]]],
        bulk_record_meta: Mapping[int, Mapping[str, Metadata]],
    ) -> List[Message[KafkaPayload]]:
        new_messages: List[Message[KafkaPayload]] = []

        for message in self.outer_message.payload:
            used_tags: Set[str] = set()
            output_message_meta: Mapping[str, MutableMapping[str, str]] = defaultdict(dict)
            partition_offset = PartitionIdxOffset(message.partition.index, message.offset)
            if partition_offset in self.skipped_offsets:
                logger.info(
                    "process_message.offset_skipped",
                    extra={"offset": message.offset, "partition": message.partition.index},
                )
                continue
            new_payload_value = cast(
                MutableMapping[Any, Any],
                self.parsed_payloads_by_offset.pop(partition_offset),
            )

            metric_name = new_payload_value["name"]
            org_id = new_payload_value["org_id"]
            sentry_sdk.set_tag("sentry_metrics.organization_id", org_id)
            tags = new_payload_value.get("tags", {})
            used_tags.add(metric_name)

            new_tags: MutableMapping[str, int] = {}
            exceeded_global_quotas = 0
            exceeded_org_quotas = 0

            try:
                for k, v in tags.items():
                    used_tags.update({k, v})
                    new_k = mapping[org_id][k]
                    if new_k is None:
                        metadata = bulk_record_meta[org_id].get(k)
                        if (
                            metadata
                            and metadata.fetch_type_ext
                            and metadata.fetch_type_ext.is_global
                        ):
                            exceeded_global_quotas += 1
                        else:
                            exceeded_org_quotas += 1
                        continue

                    value_to_write = v
                    if self.__should_index_tag_values:
                        new_v = mapping[org_id][v]
                        if new_v is None:
                            metadata = bulk_record_meta[org_id].get(v)
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
                            "org_batch_size": len(mapping[org_id]),
                        },
                    )
                continue

            fetch_types_encountered = set()
            for tag in used_tags:
                if tag in bulk_record_meta[org_id]:
                    metadata = bulk_record_meta[org_id][tag]
                    fetch_types_encountered.add(metadata.fetch_type)
                    output_message_meta[metadata.fetch_type.value][str(metadata.id)] = tag

            mapping_header_content = bytes(
                "".join(sorted(t.value for t in fetch_types_encountered)), "utf-8"
            )

            # When sending tag values as strings, set the version on the payload
            # to 2. This is used by the consumer to determine how to decode the
            # tag values.
            if not self.__should_index_tag_values:
                new_payload_value["version"] = 2
            new_payload_value["tags"] = new_tags
            new_payload_value["metric_id"] = numeric_metric_id = mapping[org_id][metric_name]
            if numeric_metric_id is None:
                metadata = bulk_record_meta[org_id].get(metric_name)
                metrics.incr(
                    "sentry_metrics.indexer.process_messages.dropped_message",
                    tags={
                        "string_type": "metric_id",
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
                            "org_batch_size": len(mapping[org_id]),
                        },
                    )
                continue

            new_payload_value["retention_days"] = 90
            new_payload_value["mapping_meta"] = output_message_meta
            new_payload_value["use_case_id"] = self.use_case_id.value

            del new_payload_value["name"]

            new_payload = KafkaPayload(
                key=message.payload.key,
                value=rapidjson.dumps(new_payload_value).encode(),
                headers=[
                    *message.payload.headers,
                    ("mapping_sources", mapping_header_content),
                    ("metric_type", new_payload_value["type"]),
                ],
            )
            new_message = Message(
                partition=message.partition,
                offset=message.offset,
                payload=new_payload,
                timestamp=message.timestamp,
            )
            new_messages.append(new_message)

        metrics.incr("metrics_consumer.process_message.messages_seen", amount=len(new_messages))
        return new_messages

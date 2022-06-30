import functools
import logging
from collections import defaultdict
from typing import List, Mapping, MutableMapping, NamedTuple, Optional, Sequence, Set

import rapidjson
import sentry_sdk
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.consumers.indexer.common import MessageBatch
from sentry.utils import json

logger = logging.getLogger(__name__)

MAX_NAME_LENGTH = 200
MAX_TAG_KEY_LENGTH = 200
MAX_TAG_VALUE_LENGTH = 200

ACCEPTED_METRIC_TYPES = {"s", "c", "d"}  # set, counter, distribution


@functools.lru_cache(maxsize=10)
def get_metrics():  # type: ignore
    from sentry.utils import metrics

    return metrics


@functools.lru_cache(maxsize=10)
def get_indexer():  # type: ignore
    from sentry.sentry_metrics import indexer

    return indexer


def valid_metric_name(name: Optional[str]) -> bool:
    if name is None:
        return False
    if len(name) > MAX_NAME_LENGTH:
        return False

    return True


def invalid_metric_tags(tags: Mapping[str, str]) -> Sequence[str]:
    invalid_strs: List[str] = []
    for key, value in tags.items():
        if key is None or len(key) > MAX_TAG_KEY_LENGTH:
            invalid_strs.append(key)
        if value is None or len(value) > MAX_TAG_VALUE_LENGTH:
            invalid_strs.append(value)

    return invalid_strs


class PartitionIdxOffset(NamedTuple):
    partition_idx: int
    offset: int


def process_messages(
    use_case_id: UseCaseKey,
    outer_message: Message[MessageBatch],
) -> MessageBatch:
    """
    We have an outer_message Message() whose payload is a batch of Message() objects.

        Message(
            partition=...,
            offset=...
            timestamp=...
            payload=[Message(...), Message(...), etc]
        )

    The inner messages payloads are KafkaPayload's that have:
        * key
        * headers
        * value

    The value of the message is what we need to parse and then translate
    using the indexer.
    """
    indexer = get_indexer()
    metrics = get_metrics()

    org_strings = defaultdict(set)
    strings = set()
    skipped_offsets: Set[PartitionIdxOffset] = set()
    with metrics.timer("process_messages.parse_outer_message"):
        parsed_payloads_by_offset: MutableMapping[PartitionIdxOffset, json.JSONData] = {}
        for msg in outer_message.payload:
            partition_offset = PartitionIdxOffset(msg.partition.index, msg.offset)
            try:
                parsed_payload = json.loads(msg.payload.value.decode("utf-8"), use_rapid_json=True)
                parsed_payloads_by_offset[partition_offset] = parsed_payload
            except rapidjson.JSONDecodeError:
                skipped_offsets.add(partition_offset)
                logger.error(
                    "process_messages.invalid_json",
                    extra={"payload_value": str(msg.payload.value)},
                    exc_info=True,
                )
                continue

        for partition_offset, message in parsed_payloads_by_offset.items():
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
                skipped_offsets.add(partition_offset)
                continue

            if metric_type not in ACCEPTED_METRIC_TYPES:
                logger.error(
                    "process_messages.invalid_metric_type",
                    extra={"org_id": org_id, "metric_type": metric_type, "offset": offset},
                )
                skipped_offsets.add(partition_offset)
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
                skipped_offsets.add(partition_offset)
                continue

            parsed_strings = {
                metric_name,
                *tags.keys(),
                *tags.values(),
            }
            org_strings[org_id].update(parsed_strings)
            strings.update(parsed_strings)

    string_count = 0
    for org_set in org_strings:
        string_count += len(org_strings[org_set])
    metrics.gauge("process_messages.lookups_per_batch", value=string_count)
    metrics.incr("process_messages.total_strings_indexer_lookup", amount=len(strings))

    with metrics.timer("metrics_consumer.bulk_record"):
        record_result = indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    mapping = record_result.get_mapped_results()
    bulk_record_meta = record_result.get_fetch_metadata()

    new_messages: List[Message[KafkaPayload]] = []

    with metrics.timer("process_messages.reconstruct_messages"):
        for message in outer_message.payload:
            used_tags: Set[str] = set()
            output_message_meta: Mapping[str, MutableMapping[str, str]] = defaultdict(dict)
            partition_offset = PartitionIdxOffset(message.partition.index, message.offset)
            if partition_offset in skipped_offsets:
                logger.info(
                    "process_message.offset_skipped",
                    extra={"offset": message.offset, "partition": message.partition.index},
                )
                continue
            new_payload_value = parsed_payloads_by_offset.pop(partition_offset)

            metric_name = new_payload_value["name"]
            org_id = new_payload_value["org_id"]
            tags = new_payload_value.get("tags", {})
            used_tags.add(metric_name)

            new_tags: MutableMapping[str, int] = {}
            try:
                for k, v in tags.items():
                    used_tags.update({k, v})
                    new_tags[str(mapping[org_id][k])] = mapping[org_id][v]
            except KeyError:
                logger.error("process_messages.key_error", extra={"tags": tags}, exc_info=True)
                continue

            fetch_types_encountered = set()
            for tag in used_tags:
                if tag in bulk_record_meta:
                    int_id, fetch_type = bulk_record_meta.get(tag)
                    fetch_types_encountered.add(fetch_type)
                    output_message_meta[fetch_type.value][str(int_id)] = tag

            mapping_header_content = bytes(
                "".join([t.value for t in fetch_types_encountered]), "utf-8"
            )
            new_payload_value["tags"] = new_tags
            new_payload_value["metric_id"] = mapping[org_id][metric_name]
            new_payload_value["retention_days"] = 90
            new_payload_value["mapping_meta"] = output_message_meta
            new_payload_value["use_case_id"] = use_case_id.value

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

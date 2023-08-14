from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Mapping, MutableMapping

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.types import Commit, Message, Partition, Topic
from confluent_kafka import Producer

from sentry import quotas
from sentry.models import Project
from sentry.spans.span import SPAN_SCHEMA_VERSION
from sentry.utils import json, kafka_config
from sentry.utils.arroyo import RunTaskWithMultiprocessing


def _build_snuba_payload(payload: Mapping[str, Any]) -> MutableMapping[str, Any]:
    project = Project.objects.get_from_cache(id=payload["project_id"])
    organization = project.organization

    span_dict: MutableMapping[str, Any] = {}
    span_dict["description"] = payload["description"]
    span_dict["exclusive_time_ms"] = int(payload.get("exclusive_time", 0))
    span_dict["is_segment"] = not payload.get("parent_span_id")
    span_dict["organization_id"] = organization.id
    span_dict["parent_span_id"] = payload.get("parent_span_id", "0")
    span_dict["project_id"] = payload["project_id"]
    span_dict["retention_days"] = quotas.get_event_retention(organization=organization) or 90
    span_dict["span_id"] = payload.get("span_id")
    span_dict["span_status"] = payload["status"]
    span_dict["tags"] = payload.get("tags")
    span_dict["trace_id"] = str(uuid.UUID(payload["trace_id"]))
    span_dict["version"] = SPAN_SCHEMA_VERSION

    start_timestamp = datetime.utcfromtimestamp(payload["start_timestamp"])
    end_timestamp = datetime.utcfromtimestamp(payload["timestamp"])
    span_dict["duration_ms"] = max(int((end_timestamp - start_timestamp).total_seconds() * 1e3), 0)

    trace_context = payload["data"]["trace"]
    span_dict["group_raw"] = trace_context["hash"]

    sentry_tags: MutableMapping[str, Any] = {}
    sentry_tags["op"] = payload.get("op")

    span_dict["sentry_tags"] = sentry_tags

    return span_dict


def process_message(message: Message[KafkaPayload]) -> KafkaPayload:
    payload = msgpack.unpackb(message.payload.value)
    payload["span"]["project_id"] = payload["project_id"]
    snuba_payload = _build_snuba_payload(payload)
    data = json.dumps(snuba_payload).encode("utf-8")
    return KafkaPayload(key=None, value=data, headers=[])


class ProcessSpansStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        output_topic: str,
        num_processes: int,
        max_batch_size: int,
        max_batch_time: int,
        input_block_size: int,
        output_block_size: int,
    ):
        super().__init__()

        self.__num_processes = num_processes
        self.__max_batch_size = max_batch_size
        self.__max_batch_time = max_batch_time
        self.__input_block_size = input_block_size
        self.__output_block_size = output_block_size

        snuba_spans = kafka_config.get_topic_definition(output_topic)
        self.__output_topic = Topic(name=output_topic)
        self.__producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(snuba_spans["cluster"]),
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskWithMultiprocessing(
            num_processes=self.__num_processes,
            max_batch_size=self.__max_batch_size,
            max_batch_time=self.__max_batch_time,
            input_block_size=self.__input_block_size,
            output_block_size=self.__output_block_size,
            function=process_message,
            next_step=Produce(
                producer=self.__producer,
                topic=self.__output_topic,
                next_step=CommitOffsets(commit),
            ),
        )

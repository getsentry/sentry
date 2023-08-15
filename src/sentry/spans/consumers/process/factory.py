from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Mapping, MutableMapping

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload, KafkaProducer
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.types import Commit, Message, Partition, Topic

from sentry import quotas
from sentry.models import Project
from sentry.spans.span import SPAN_SCHEMA_VERSION
from sentry.utils import json, kafka_config
from sentry.utils.arroyo import RunTaskWithMultiprocessing


def _build_snuba_span(relay_span: Mapping[str, Any]) -> MutableMapping[str, Any]:
    project = Project.objects.get_from_cache(id=relay_span["project_id"])
    organization = project.organization
    retention_days = (
        quotas.get_event_retention(
            organization=organization,
        )
        or 90
    )

    snuba_span: MutableMapping[str, Any] = {}
    snuba_span["description"] = relay_span["description"]
    snuba_span["exclusive_time_ms"] = int(relay_span.get("exclusive_time", 0))
    snuba_span["is_segment"] = not relay_span.get("parent_span_id")
    snuba_span["organization_id"] = organization.id
    snuba_span["parent_span_id"] = relay_span.get("parent_span_id", "0")
    snuba_span["project_id"] = relay_span["project_id"]
    snuba_span["retention_days"] = retention_days
    snuba_span["span_id"] = relay_span.get("span_id")
    snuba_span["span_status"] = relay_span["status"]
    snuba_span["tags"] = relay_span.get("tags")
    snuba_span["trace_id"] = str(uuid.UUID(relay_span["trace_id"]))
    snuba_span["version"] = SPAN_SCHEMA_VERSION

    start_timestamp = datetime.utcfromtimestamp(relay_span["start_timestamp"])
    end_timestamp = datetime.utcfromtimestamp(relay_span["timestamp"])
    snuba_span["duration_ms"] = max(
        int((end_timestamp - start_timestamp).total_seconds() * 1e3),
        0,
    )

    trace_context = relay_span.get("data", {}).get("trace")
    if trace_context:
        snuba_span["group_raw"] = trace_context["hash"]

    sentry_tags: MutableMapping[str, Any] = {}
    sentry_tags["op"] = relay_span.get("op")

    snuba_span["sentry_tags"] = sentry_tags

    return snuba_span


def process_message(message: Message[KafkaPayload]) -> KafkaPayload:
    payload = msgpack.unpackb(message.payload.value)
    relay_span = payload["span"]
    relay_span["project_id"] = payload["project_id"]
    snuba_span = _build_snuba_span(relay_span)
    snuba_payload = json.dumps(snuba_span).encode("utf-8")
    return KafkaPayload(key=None, value=snuba_payload, headers=[])


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
        self.__producer = KafkaProducer(
            kafka_config.get_kafka_producer_cluster_options(
                snuba_spans["cluster"],
            ),
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

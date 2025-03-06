from __future__ import annotations

import logging
import time
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any

from confluent_kafka import KafkaError
from confluent_kafka import Message as KafkaMessage
from confluent_kafka import Producer

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.eventstream.base import GroupStates
from sentry.eventstream.snuba import KW_SKIP_SEMANTIC_PARTITIONING, SnubaProtocolEventStream
from sentry.eventstream.types import EventStreamEventType
from sentry.killswitches import killswitch_matches_context
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.eventstore.models import Event, GroupEvent


class KafkaEventStream(SnubaProtocolEventStream):
    def __init__(self, **options: Any) -> None:
        super().__init__(**options)
        self.topic = Topic.EVENTS
        self.transactions_topic = Topic.TRANSACTIONS
        self.issue_platform_topic = Topic.EVENTSTREAM_GENERIC
        self.__producers: MutableMapping[Topic, Producer] = {}
        self.error_last_logged_time: int | None = None

    def get_transactions_topic(self, project_id: int) -> Topic:
        return self.transactions_topic

    def get_producer(self, topic: Topic) -> Producer:
        if topic not in self.__producers:
            cluster_name = get_topic_definition(topic)["cluster"]
            cluster_options = get_kafka_producer_cluster_options(cluster_name)
            self.__producers[topic] = Producer(cluster_options)

        return self.__producers[topic]

    def delivery_callback(self, error: KafkaError | None, message: KafkaMessage) -> None:
        now = int(time.time())
        if error is not None:
            if self.error_last_logged_time is None or now > self.error_last_logged_time + 60:
                self.error_last_logged_time = now
                logger.error("Could not publish message (error: %s): %r", error, message)

    def _get_headers_for_insert(
        self,
        event: Event | GroupEvent,
        is_new: bool,
        is_regression: bool,
        is_new_group_environment: bool,
        primary_hash: str | None,
        received_timestamp: float | datetime,
        skip_consume: bool,
        group_states: GroupStates | None = None,
    ) -> MutableMapping[str, str]:
        # HACK: We are putting all this extra information that is required by the
        # post process forwarder into the headers so we can skip parsing entire json
        # messages. The post process forwarder is currently bound to a single core.
        # Once we are able to parallelize the JSON parsing and other transformation
        # steps being done there we may want to remove this hack.
        def encode_bool(value: bool | None) -> str:
            if value is None:
                value = False
            return str(int(value))

        def encode_list(value: Sequence[Any]) -> str:
            return json.dumps(value)

        # we strip `None` values here so later in the pipeline they can be
        # cleanly encoded without nullability checks
        def strip_none_values(value: Mapping[str, str | None]) -> MutableMapping[str, str]:
            return {key: value for key, value in value.items() if value is not None}

        send_new_headers = options.get("eventstream:kafka-headers")

        if send_new_headers is True:
            return strip_none_values(
                {
                    "Received-Timestamp": str(received_timestamp),
                    "event_id": str(event.event_id),
                    "project_id": str(event.project_id),
                    "occurrence_id": self._get_occurrence_data(event).get("id"),
                    "group_id": str(event.group_id) if event.group_id is not None else None,
                    "primary_hash": str(primary_hash) if primary_hash is not None else None,
                    "is_new": encode_bool(is_new),
                    "is_new_group_environment": encode_bool(is_new_group_environment),
                    "is_regression": encode_bool(is_regression),
                    "skip_consume": encode_bool(skip_consume),
                    "group_states": encode_list(group_states) if group_states is not None else None,
                    "queue": self._get_queue_for_post_process(event),
                }
            )
        else:
            return {
                **super()._get_headers_for_insert(
                    event,
                    is_new,
                    is_regression,
                    is_new_group_environment,
                    primary_hash,
                    received_timestamp,
                    skip_consume,
                ),
            }

    def insert(
        self,
        event: Event | GroupEvent,
        is_new: bool,
        is_regression: bool,
        is_new_group_environment: bool,
        primary_hash: str | None,
        received_timestamp: float | datetime,
        skip_consume: bool = False,
        group_states: GroupStates | None = None,
        eventstream_type: str | None = None,
        **kwargs: Any,
    ) -> None:

        event_type = self._get_event_type(event)
        assign_partitions_randomly = (
            (event_type == EventStreamEventType.Generic)
            or (event_type == EventStreamEventType.Transaction)
            or killswitch_matches_context(
                "kafka.send-project-events-to-random-partitions",
                {"project_id": event.project_id, "message_type": event_type.value},
            )
        )

        if assign_partitions_randomly:
            kwargs[KW_SKIP_SEMANTIC_PARTITIONING] = True

        if event.get_tag("sample_event"):
            kwargs["asynchronous"] = False

        super().insert(
            event,
            is_new,
            is_regression,
            is_new_group_environment,
            primary_hash,
            received_timestamp,
            skip_consume,
            group_states,
            eventstream_type=eventstream_type,
            **kwargs,
        )

    def _send(
        self,
        project_id: int,
        _type: str,
        extra_data: tuple[Any, ...] = (),
        asynchronous: bool = True,
        headers: MutableMapping[str, str] | None = None,
        skip_semantic_partitioning: bool = False,
        event_type: EventStreamEventType = EventStreamEventType.Error,
    ) -> None:
        if headers is None:
            headers = {}
        headers["operation"] = _type
        headers["version"] = str(self.EVENT_PROTOCOL_VERSION)

        if event_type == EventStreamEventType.Transaction:
            topic = self.get_transactions_topic(project_id)
        elif event_type == EventStreamEventType.Generic:
            topic = self.issue_platform_topic
        else:
            topic = self.topic

        producer = self.get_producer(topic)

        # Polling the producer is required to ensure callbacks are fired. This
        # means that the latency between a message being delivered (or failing
        # to be delivered) and the corresponding callback being fired is
        # roughly the same as the duration of time that passes between publish
        # calls. If this ends up being too high, the publisher should be moved
        # into a background thread that can poll more frequently without
        # interfering with request handling. (This does `poll` does not act as
        # a heartbeat for the purposes of any sort of session expiration.)
        # Note that this call to poll() is *only* dealing with earlier
        # asynchronous produce() calls from the same process.
        producer.poll(0.0)

        assert isinstance(extra_data, tuple)

        real_topic = get_topic_definition(topic)["real_topic_name"]

        try:
            producer.produce(
                topic=real_topic,
                key=str(project_id).encode("utf-8") if not skip_semantic_partitioning else None,
                value=json.dumps((self.EVENT_PROTOCOL_VERSION, _type) + extra_data),
                on_delivery=self.delivery_callback,
                headers=[(k, v.encode("utf-8")) for k, v in headers.items()],
            )
        except Exception as error:
            logger.exception("Could not publish message: %s", error)
            return

        if not asynchronous:
            # flush() is a convenience method that calls poll() until len() is zero
            producer.flush()

    def requires_post_process_forwarder(self) -> bool:
        return True

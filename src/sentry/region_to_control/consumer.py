import signal
from typing import Any, Mapping, Optional

import sentry_sdk
from arroyo import Partition, Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import Commit, Message
from django.conf import settings
from django.db import IntegrityError

from sentry.models import AuditLogEntry, UserIP
from sentry.utils import json, metrics

from ..utils.kafka_config import get_kafka_consumer_cluster_options
from .messages import AuditLogEvent, RegionToControlMessage, UserIpEvent


def get_region_to_control_consumer(
    group_id: str,
    auto_offset_reset: str = "earliest",
    **opts: Any,
) -> StreamProcessor[KafkaPayload]:
    assert group_id is not None

    cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_REGION_TO_CONTROL]["cluster"]
    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            default_config=get_kafka_consumer_cluster_options(
                cluster_name,
            ),
            auto_offset_reset=auto_offset_reset,
            group_id=group_id,
        )
    )

    processor = StreamProcessor(
        consumer=consumer,
        topic=Topic(settings.KAFKA_REGION_TO_CONTROL),
        processor_factory=RegionToControlStrategyFactory(),
        commit_policy=ONCE_PER_SECOND,
    )

    def handler(*args: Any) -> None:
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    return processor


class ProcessRegionToControlMessage(ProcessingStrategy[KafkaPayload]):
    def __init__(self, next_step: ProcessingStrategy[KafkaPayload]) -> None:
        self.__next_step = next_step

    def poll(self) -> None:
        self.__next_step.poll()

    def submit(self, message: Message[KafkaPayload]) -> None:
        raw = json.loads(message.payload.value.decode("utf8"))
        region_to_control_message = RegionToControlMessage.from_payload(raw)

        if region_to_control_message.user_ip_event:
            self._handle_user_ip_event(region_to_control_message.user_ip_event)
        if region_to_control_message.audit_log_event:
            self._handle_audit_log_event(region_to_control_message.audit_log_event)

        self.__next_step.submit(message)

    def _handle_audit_log_event(
        self, audit_log_entry: AuditLogEvent, reentry: bool = False
    ) -> None:
        entry = AuditLogEntry.from_event(audit_log_entry)
        try:
            entry.save()
            metrics.incr("region_to_control.consumer.audit_log_entry.created")
        except IntegrityError as e:
            error_message = str(e)
            if '"sentry_organization"' in error_message:
                metrics.incr("region_to_control.consumer.audit_log_entry.stale_event")
                with sentry_sdk.push_scope() as scope:
                    scope.level = "warning"
                    scope.set_tag("organization_id", audit_log_entry.organization_id)
                    scope.set_tag("event_id", audit_log_entry.event_id)
                    sentry_sdk.capture_message(
                        "Stale organization in audit log entry detected, org may be deleted."
                    )
                return
            if '"auth_user"' in error_message:
                # It is possible that a user existed at the time of serialization but was deleted by the time of consumption
                # in which case we follow the database's SET NULL on delete handling.
                audit_log_entry.actor_user_id = None
                if reentry:
                    raise
                return self._handle_audit_log_event(audit_log_entry, reentry=True)
            else:
                raise

    def _handle_user_ip_event(self, user_ip_event: UserIpEvent) -> None:
        updated, created = UserIP.objects.create_or_update(
            values=dict(
                user_id=user_ip_event.user_id,
                ip_address=user_ip_event.ip_address,
                last_seen=user_ip_event.last_seen,
                country_code=user_ip_event.country_code,
                region_code=user_ip_event.region_code,
            )
        )
        if created:
            metrics.incr("region_to_control.consumer.user_ip_event.created")
        elif updated:
            metrics.incr("region_to_control.consumer.user_ip_event.updated", amount=updated)
        else:
            # This happens when there is an integrity error adding the UserIP -- such as when user is deleted,
            # or the ip address does not match the db validation.  This is expected and not an error condition
            # in low quantities.
            metrics.incr("region_to_control.consumer.user_ip_event.stale_event")

    def close(self) -> None:
        self.__next_step.close()

    def terminate(self) -> None:
        self.__next_step.terminate()

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.join(timeout)


class RegionToControlStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return ProcessRegionToControlMessage(CommitOffsets(commit))

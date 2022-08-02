import logging
from dataclasses import dataclass
from typing import Any, Literal, Mapping, Union

from django.conf import settings

from sentry import quotas
from sentry.eventstream.abstract import EventStreamAPI
from sentry.eventstream.backends import KafkaEventStreamBackend, SnubaEventStreamBackend
from sentry.eventstream.utils import (
    dispatch_post_process_group_task,
    encode_bool,
    get_unexpected_tags,
    strip_none_values,
)
from sentry.utils.sdk import set_current_event_project
from sentry.utils.services import Service

logger = logging.getLogger(__name__)

from sentry.eventstream.kafka.postprocessworker import TransactionsPostProcessForwarderWorker


@dataclass
class TransactionsInsertData:
    event: Any
    received_timestamp: float
    skip_consume: bool


class TransactionsEventStreamAPI(EventStreamAPI, Service):
    __all__ = ("insert",)

    def __init__(self):
        self._backend = None

    def run_post_process_forwarder(
        self,
        consumer_group: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int = 100,
        commit_batch_timeout_ms: int = 5000,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]] = "latest",
    ) -> bool:
        self._backend.run_forwarder(
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            commit_batch_size=commit_batch_size,
            commit_batch_timeout_ms=commit_batch_timeout_ms,
            initial_offset_reset=initial_offset_reset,
        )

    def requires_post_process_forwarder(self):
        return self._backend.requires_post_process_forwarder is not None

    def _get_extra_data(self, event, event_data, project, skip_consume: bool = False) -> Mapping:
        retention_days = quotas.get_event_retention(organization=project.organization)
        return (
            {
                "event_id": event.event_id,
                "organization_id": project.organization_id,
                "project_id": event.project_id,
                # TODO(mitsuhiko): We do not want to send this incorrect
                # message but this is what snuba needs at the moment.
                "message": event.search_message,
                "platform": event.platform,
                "datetime": event.datetime,
                "data": event_data,
                "retention_days": retention_days,
            },
            {
                "skip_consume": skip_consume,
            },
        )

    def insert(self, data: TransactionsInsertData) -> None:
        project = data.event.project
        set_current_event_project(project.id)
        event_data = data.event.get_raw_data(for_stream=True)

        unexpected_tags = get_unexpected_tags(event_data)
        if unexpected_tags:
            logger.error("%r received unexpected tags: %r", self, unexpected_tags)

        headers = strip_none_values(
            {
                "Received-Timestamp": str(data.received_timestamp),
                "event_id": str(data.event.event_id),
                "project_id": str(data.event.project_id),
                "group_id": None,
                "primary_hash": None,
                "is_new": encode_bool(False),
                "is_new_group_environment": encode_bool(False),
                "is_regression": encode_bool(False),
                "skip_consume": encode_bool(data.skip_consume),
                "transaction_forwarder": encode_bool(False),
            }
        )

        self._backend.send(
            project.id,
            "insert",
            extra_data=self._get_extra_data(data.event, event_data, project, data.skip_consume),
            headers=headers,
        )

        dispatch_post_process_group_task(
            data.event.event_id,
            data.event.project_id,
            data.event.group_id,
            None,
            None,
            None,
            None,
            data.skip_consume,
        )


class SnubaTransactionsEventStreamAPI(TransactionsEventStreamAPI):
    def __init__(self):
        self._backend = SnubaEventStreamBackend("transactions")


class KafkaTransactionsEventStreamAPI(TransactionsEventStreamAPI):
    def __init__(self):
        def assign_partitions_randomly(project_id: int) -> bool:
            return True

        self._backend = KafkaEventStreamBackend(
            topic=settings.KAFKA_TRANSACTIONS,
            worker=TransactionsPostProcessForwarderWorker,
            assign_partitions_randomly=assign_partitions_randomly,
        )

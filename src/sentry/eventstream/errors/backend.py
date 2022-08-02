import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Mapping, Union
from uuid import uuid4

import pytz
from django.conf import settings

from sentry import quotas
from sentry.eventstream.abstract import EventStreamAPI
from sentry.eventstream.backends import KafkaEventStreamBackend, SnubaEventStreamBackend
from sentry.eventstream.kafka.postprocessworker import ErrorsPostProcessForwarderWorker
from sentry.eventstream.utils import (
    dispatch_post_process_group_task,
    encode_bool,
    get_unexpected_tags,
    strip_none_values,
)
from sentry.killswitches import killswitch_matches_context
from sentry.utils.sdk import set_current_event_project
from sentry.utils.services import Service

logger = logging.getLogger(__name__)


@dataclass
class ErrorsInsertData:
    group: Any
    event: Any
    is_new: bool
    is_regression: bool
    is_new_group_environment: bool
    primary_hash: str
    received_timestamp: float
    skip_consume: bool


class ErrorsEventStreamAPI(EventStreamAPI, Service):
    __all__ = (
        "insert",
        "start_delete_groups",
        "end_delete_groups",
        "start_merge",
        "end_merge",
        "start_unmerge",
        "end_unmerge",
        "start_delete_tag",
        "end_delete_tag",
        "tombstone_events_unsafe",
        "replace_group_unsafe",
        "exclude_groups",
        "requires_post_process_forwarder",
        "run_post_process_forwarder",
    )

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
        return self._backend.requires_post_process_forwarder

    def _get_extra_data(self, data: ErrorsInsertData, project, event_data) -> Mapping:
        retention_days = quotas.get_event_retention(organization=project.organization)
        event = data.event
        return (
            {
                "group_id": event.group_id,
                "event_id": event.event_id,
                "organization_id": project.organization_id,
                "project_id": event.project_id,
                # TODO(mitsuhiko): We do not want to send this incorrect
                # message but this is what snuba needs at the moment.
                "message": event.search_message,
                "platform": event.platform,
                "datetime": event.datetime,
                "data": event_data,
                "primary_hash": data.primary_hash,
                "retention_days": retention_days,
            },
            {
                "is_new": data.is_new,
                "is_regression": data.is_regression,
                "is_new_group_environment": data.is_new_group_environment,
                "skip_consume": data.skip_consume,
            },
        )

    def insert(self, data: ErrorsInsertData) -> None:
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
                "group_id": str(data.event.group_id),
                "primary_hash": str(data.primary_hash),
                "is_new": encode_bool(data.is_new),
                "is_new_group_environment": encode_bool(data.is_new_group_environment),
                "is_regression": encode_bool(data.is_regression),
                "skip_consume": encode_bool(data.skip_consume),
                "transaction_forwarder": encode_bool(True),
            }
        )

        self._backend.send(
            project.id,
            "insert",
            extra_data=self._get_extra_data(data, project, event_data),
            headers=headers,
        )

        dispatch_post_process_group_task(
            data.event.event_id,
            data.event.project_id,
            data.event.group_id,
            data.is_new,
            data.is_regression,
            data.is_new_group_environment,
            data.primary_hash,
            data.skip_consume,
        )

    def start_delete_groups(self, project_id, group_ids):
        if not group_ids:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "group_ids": list(group_ids),
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._backend.send(
            project_id, "start_delete_groups", extra_data=(state,), asynchronous=False
        )

        return state

    def end_delete_groups(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._backend.send(
            state["project_id"], "end_delete_groups", extra_data=(state,), asynchronous=False
        )

    def start_merge(self, project_id, previous_group_ids, new_group_id):
        if not previous_group_ids:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "previous_group_ids": list(previous_group_ids),
            "new_group_id": new_group_id,
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._backend.send(project_id, "start_merge", extra_data=(state,), asynchronous=False)

        return state

    def end_merge(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._backend.send(
            state["project_id"], "end_merge", extra_data=(state,), asynchronous=False
        )

    def start_unmerge(self, project_id, hashes, previous_group_id, new_group_id):
        if not hashes:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "previous_group_id": previous_group_id,
            "new_group_id": new_group_id,
            "hashes": list(hashes),
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._backend.send(project_id, "start_unmerge", extra_data=(state,), asynchronous=False)

        return state

    def end_unmerge(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._backend.send(
            state["project_id"], "end_unmerge", extra_data=(state,), asynchronous=False
        )

    def start_delete_tag(self, project_id, tag):
        if not tag:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "tag": tag,
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._backend.send(project_id, "start_delete_tag", extra_data=(state,), asynchronous=False)

        return state

    def end_delete_tag(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._backend.send(
            state["project_id"], "end_delete_tag", extra_data=(state,), asynchronous=False
        )

    def tombstone_events_unsafe(
        self, project_id, event_ids, old_primary_hash=False, from_timestamp=None, to_timestamp=None
    ):
        """
        Tell Snuba to eventually delete these events.

        This marks events as deleted but does not immediately exclude those
        events from all queries. Because of that limitation this is not proper,
        because not immediate, event deletion.

        "Proper" group deletion is essentially running this function for every
        event in the group, plus `exclude_groups` to make sure the changes are
        immediately user-visible.

        Reprocessing (v2) splits a group into events-to-be-reprocessed
        (re-insert with new group_id) and events-to-be-deleted
        (`tombstone_events`), then excludes the group from all queries
        (`exclude_groups`).

        :param old_primary_hash: If present, the event is only tombstoned
            to be reinserted over with a guaranteed-different primary hash.
            This is necessary with Snuba's errors table as the primary_hash is
            part of the PK/sortkey.
        """

        state = {
            "project_id": project_id,
            "event_ids": event_ids,
            "old_primary_hash": old_primary_hash,
            "from_timestamp": from_timestamp,
            "to_timestamp": to_timestamp,
        }
        self._backend.send(project_id, "tombstone_events", extra_data=(state,), asynchronous=False)

    def replace_group_unsafe(
        self, project_id, event_ids, new_group_id, from_timestamp=None, to_timestamp=None
    ):
        """
        Tell Snuba to move events into a new group ID

        Same caveats as tombstone_events
        """

        state = {
            "project_id": project_id,
            "event_ids": event_ids,
            "new_group_id": new_group_id,
            "from_timestamp": from_timestamp,
            "to_timestamp": to_timestamp,
        }
        self._backend.send(project_id, "replace_group", extra_data=(state,), asynchronous=False)

    def exclude_groups(self, project_id, group_ids):
        """
        Exclude a group from queries for a while until event tombstoning takes
        effect. See docstring of `tombstone_events`.

        `exclude_groups` basically makes Snuba add `where group_id not in (1,
        2, ...)` to every query.
        """
        state = {"project_id": project_id, "group_ids": group_ids}
        self._backend.send(project_id, "exclude_groups", extra_data=(state,), asynchronous=False)


class SnubaErrorsEventStreamAPI(ErrorsEventStreamAPI):
    def __init__(self):
        self._backend = SnubaEventStreamBackend("events")


class KafkaErrorsEventStreamAPI(ErrorsEventStreamAPI):
    def __init__(self):
        def assign_partitions_randomly(project_id: int) -> bool:
            return killswitch_matches_context(
                "kafka.send-project-events-to-random-partitions",
                {"project_id": project_id, "message_type": "error"},
            )

        self._backend = KafkaEventStreamBackend(
            topic=settings.KAFKA_EVENTS,
            worker=ErrorsPostProcessForwarderWorker,
            assign_partitions_randomly=assign_partitions_randomly,
        )

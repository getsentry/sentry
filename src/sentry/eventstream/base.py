from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Any,
    Collection,
    Literal,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    TypedDict,
    Union,
    cast,
)

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.post_process_forwarder import PostProcessForwarderType
from sentry.tasks.post_process import post_process_group
from sentry.utils.cache import cache_key_for_event
from sentry.utils.services import Service

logger = logging.getLogger(__name__)


if TYPE_CHECKING:
    from sentry.eventstore.models import Event, GroupEvent


class ForwarderNotRequired(NotImplementedError):
    """
    Exception raised if this backend does not require a forwarder process to
    enqueue post-processing tasks.
    """


class GroupState(TypedDict):
    id: int
    is_new: bool
    is_regression: bool
    is_new_group_environment: bool


GroupStates = Sequence[GroupState]


class EventStreamEventType(Enum):
    """
    We have 3 broad categories of event types that we care about in eventstream.
    """

    Error = "error"  # error, default, various security errors
    Transaction = "transaction"  # transactions
    Generic = "generic"  # generic events ingested via the issue platform


class EventStream(Service):
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
        "_get_event_type",
    )

    def _dispatch_post_process_group_task(
        self,
        event_id: str,
        project_id: int,
        group_id: Optional[int],
        is_new: bool,
        is_regression: bool,
        is_new_group_environment: bool,
        primary_hash: Optional[str],
        queue: str,
        skip_consume: bool = False,
        group_states: Optional[GroupStates] = None,
        occurrence_id: Optional[str] = None,
    ) -> None:
        if skip_consume:
            logger.info("post_process.skip.raw_event", extra={"event_id": event_id})
        else:
            cache_key = cache_key_for_event({"project": project_id, "event_id": event_id})

            post_process_group.apply_async(
                kwargs={
                    "is_new": is_new,
                    "is_regression": is_regression,
                    "is_new_group_environment": is_new_group_environment,
                    "primary_hash": primary_hash,
                    "cache_key": cache_key,
                    "group_id": group_id,
                    "group_states": group_states,
                    "occurrence_id": occurrence_id,
                    "project_id": project_id,
                },
                queue=queue,
            )

    def _get_queue_for_post_process(self, event: Event) -> str:
        event_type = self._get_event_type(event)
        if event_type == EventStreamEventType.Transaction:
            return "post_process_transactions"
        elif event_type == EventStreamEventType.Generic:
            return "post_process_issue_platform"
        else:
            return "post_process_errors"

    def _get_occurrence_data(self, event: Event | GroupEvent) -> MutableMapping[str, Any]:
        occurrence = cast(Optional[IssueOccurrence], getattr(event, "occurrence", None))
        occurrence_data: MutableMapping[str, Any] = {}
        if occurrence:
            occurrence_data = cast(MutableMapping[str, Any], occurrence.to_dict())
            del occurrence_data["evidence_data"]
            del occurrence_data["evidence_display"]
        return occurrence_data

    def insert(
        self,
        event: Event | GroupEvent,
        is_new: bool,
        is_regression: bool,
        is_new_group_environment: bool,
        primary_hash: Optional[str],
        received_timestamp: float,
        skip_consume: bool = False,
        group_states: Optional[GroupStates] = None,
    ) -> None:
        self._dispatch_post_process_group_task(
            event.event_id,
            event.project_id,
            event.group_id,
            is_new,
            is_regression,
            is_new_group_environment,
            primary_hash,
            self._get_queue_for_post_process(event),
            skip_consume,
            group_states,
            occurrence_id=event.occurrence_id if isinstance(event, GroupEvent) else None,
        )

    def start_delete_groups(
        self, project_id: int, group_ids: Sequence[int]
    ) -> Optional[Mapping[str, Any]]:
        pass

    def end_delete_groups(self, state: Mapping[str, Any]) -> None:
        pass

    def start_merge(
        self, project_id: int, previous_group_ids: Sequence[int], new_group_id: int
    ) -> Optional[Mapping[str, Any]]:
        pass

    def end_merge(self, state: Mapping[str, Any]) -> None:
        pass

    def start_unmerge(
        self, project_id: int, hashes: Collection[str], previous_group_id: int, new_group_id: int
    ) -> Optional[Mapping[str, Any]]:
        pass

    def end_unmerge(self, state: Mapping[str, Any]) -> None:
        pass

    def start_delete_tag(self, project_id: int, tag: str) -> Optional[Mapping[str, Any]]:
        pass

    def end_delete_tag(self, state: Mapping[str, Any]) -> None:
        pass

    def tombstone_events_unsafe(
        self,
        project_id: int,
        event_ids: Sequence[str],
        old_primary_hash: Optional[str] = None,
        from_timestamp: Optional[datetime] = None,
        to_timestamp: Optional[datetime] = None,
    ) -> None:
        pass

    def replace_group_unsafe(
        self, project_id: int, event_ids: Sequence[str], new_group_id: int
    ) -> None:
        pass

    def exclude_groups(self, project_id: int, group_ids: Sequence[int]) -> None:
        pass

    def requires_post_process_forwarder(self) -> bool:
        return False

    def run_post_process_forwarder(
        self,
        entity: PostProcessForwarderType,
        consumer_group: str,
        topic: Optional[str],
        commit_log_topic: str,
        synchronize_commit_group: str,
        concurrency: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
        strict_offset_reset: bool,
    ) -> None:
        assert not self.requires_post_process_forwarder()
        raise ForwarderNotRequired

    @staticmethod
    def _get_event_type(event: Event | GroupEvent) -> EventStreamEventType:
        if getattr(event, "occurrence", None):
            # For now, all events with an associated occurrence are specific to the issue platform.
            # When/if we move errors and transactions onto the platform, this might change.
            return EventStreamEventType.Generic
        if event.get_event_type() == "transaction":
            return EventStreamEventType.Transaction
        return EventStreamEventType.Error

from __future__ import annotations

import random
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

import pydantic

import sentry.workflow_engine.buffer as buffer
from sentry.utils import json
from sentry.workflow_engine.models import Workflow

if TYPE_CHECKING:
    from sentry.services.eventstore.models import GroupEvent
    from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer


class CohortUpdates(pydantic.BaseModel):
    values: dict[int, float]


DataConditionGroupId = int


@dataclass
class DelayedWorkflowItem:
    workflow: Workflow
    event: GroupEvent
    delayed_when_group_id: DataConditionGroupId | None
    delayed_if_group_ids: list[DataConditionGroupId]
    passing_if_group_ids: list[DataConditionGroupId]

    # Used to pick the end of the time window in snuba querying.
    # Should be close to when fast conditions were evaluated to try to be consistent.
    timestamp: datetime

    def buffer_key(self) -> str:
        when_condition_group_str = (
            str(self.delayed_when_group_id) if self.delayed_when_group_id else ""
        )
        if_condition_groups = ",".join(str(id) for id in sorted(self.delayed_if_group_ids))
        passing_if_groups = ",".join(str(id) for id in sorted(self.passing_if_group_ids))
        return f"{self.workflow.id}:{self.event.group.id}:{when_condition_group_str}:{if_condition_groups}:{passing_if_groups}"

    def buffer_value(self) -> str:
        return json.dumps(
            {
                "event_id": self.event.event_id,
                "occurrence_id": self.event.occurrence_id,
                "timestamp": self.timestamp,
            }
        )


class DelayedWorkflowClient:
    """
    Client for interacting with batch processing of delayed workflows.
    This is used for managing the listing of projects that need to be processed
    """

    _BUFFER_KEY = "workflow_engine_delayed_processing_buffer"
    _BUFFER_SHARDS = 8
    option = "delayed_workflow.rollout"

    def __init__(
        self, buf: RedisHashSortedSetBuffer | None = None, buffer_keys: list[str] | None = None
    ) -> None:
        self._buffer = buf or buffer.get_backend()
        self._buffer_keys = tuple(buffer_keys or self._get_buffer_keys())

    def add_project_ids(self, project_ids: list[int]) -> None:
        """Add project IDs to a random shard for processing."""
        sharded_key = random.choice(self._buffer_keys)
        self._buffer.push_to_sorted_set(key=sharded_key, value=project_ids)

    def get_project_ids(self, min: float, max: float) -> dict[int, list[float]]:
        """Get project IDs within the specified score range from all shards."""
        return self._buffer.bulk_get_sorted_set(
            self._buffer_keys,
            min=min,
            max=max,
        )

    def clear_project_ids(self, min: float, max: float) -> None:
        """Remove project IDs within the specified score range from all shards."""
        self._buffer.delete_keys(
            self._buffer_keys,
            min=min,
            max=max,
        )

    def mark_project_ids_as_processed(
        self, project_id_max_timestamps: Mapping[int, float]
    ) -> list[int]:
        """
        Mark project IDs as processed, removing any requests for them at the associated timestamp or earlier.

        Returns a list of project IDs that were deleted.
        """
        result = self._buffer.conditional_delete_from_sorted_sets(
            self._buffer_keys,
            list(project_id_max_timestamps.items()),
        )
        return list(set().union(*result.values()))

    @classmethod
    def _get_buffer_keys(cls) -> list[str]:
        return [
            f"{cls._BUFFER_KEY}:{shard}" if shard > 0 else cls._BUFFER_KEY
            for shard in range(cls._BUFFER_SHARDS)
        ]

    _COHORT_UPDATES_KEY = "WORKFLOW_ENGINE_COHORT_UPDATES"

    def fetch_updates(self) -> CohortUpdates:
        return self._buffer.get_parsed_key(
            self._COHORT_UPDATES_KEY, CohortUpdates
        ) or CohortUpdates(values={})

    def persist_updates(self, cohort_updates: CohortUpdates) -> None:
        self._buffer.put_parsed_key(self._COHORT_UPDATES_KEY, cohort_updates)

    def for_project(self, project_id: int) -> ProjectDelayedWorkflowClient:
        """Create a project-specific client for workflow operations."""
        return ProjectDelayedWorkflowClient(project_id, self._buffer)


class ProjectDelayedWorkflowClient:
    """
    Project-specific client for interacting with batch processing of delayed workflows.
    This is used for managing the hash (aka dictionary) of group-to-event data used to
    aggregate event data that needs to be processed.
    """

    def __init__(self, project_id: int, buffer: RedisHashSortedSetBuffer) -> None:
        self.project_id = project_id
        self._buffer = buffer

    def _filters(self, batch_key: str | None) -> Mapping[str, int | str]:
        filters: dict[str, int | str] = {"project_id": self.project_id}
        if batch_key:
            filters["batch_key"] = batch_key
        return filters

    def delete_hash_fields(self, batch_key: str | None, fields: list[str]) -> None:
        """Delete specific fields from the workflow hash."""
        self._buffer.delete_hash(model=Workflow, filters=self._filters(batch_key), fields=fields)

    def get_hash_length(self, batch_key: str | None = None) -> int:
        """Get the number of fields in the workflow hash."""
        return self._buffer.get_hash_length(model=Workflow, filters=self._filters(batch_key))

    def get_hash_data(self, batch_key: str | None = None) -> dict[str, str]:
        """Fetch all group-to-event data from the workflow hash."""
        return self._buffer.get_hash(model=Workflow, filters=self._filters(batch_key))

    def push_to_hash(self, batch_key: str | None, data: dict[str, str]) -> None:
        """Push data to the workflow hash in bulk."""
        self._buffer.push_to_hash_bulk(model=Workflow, filters=self._filters(batch_key), data=data)

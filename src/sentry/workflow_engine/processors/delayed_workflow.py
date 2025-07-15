from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import cached_property
from typing import Any, TypeAlias

import sentry_sdk
from celery import Task
from django.utils import timezone
from pydantic import BaseModel, validator

from sentry import buffer, features, nodestore
from sentry.buffer.base import BufferField
from sentry.db import models
from sentry.eventstore.models import Event, GroupEvent
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.rules.conditions.event_frequency import COMPARISON_INTERVALS
from sentry.rules.processing.buffer_processing import (
    BufferHashKeys,
    DelayedProcessingBase,
    FilterKeys,
    delayed_processing_registry,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.post_process import should_retry_fetch
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry, retry_task
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.registry import NoRegistrationExistsError
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.snuba import SnubaError
from sentry.workflow_engine.handlers.condition.event_frequency_query_handlers import (
    BaseEventFrequencyQueryHandler,
    GroupValues,
    QueryFilter,
    QueryResult,
    slow_condition_query_handler_registry,
)
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, Workflow
from sentry.workflow_engine.models.data_condition import (
    PERCENT_CONDITIONS,
    SLOW_CONDITIONS,
    Condition,
)
from sentry.workflow_engine.models.workflow_data_condition_group import WorkflowDataConditionGroup
from sentry.workflow_engine.processors.action import filter_recently_fired_workflow_actions
from sentry.workflow_engine.processors.data_condition_group import (
    evaluate_data_conditions,
    get_slow_conditions_for_groups,
)
from sentry.workflow_engine.processors.detector import get_detectors_by_groupevents_bulk
from sentry.workflow_engine.processors.log_util import log_if_slow, track_batch_performance
from sentry.workflow_engine.processors.workflow import (
    WORKFLOW_ENGINE_BUFFER_LIST_KEY,
    evaluate_action_filters,
)
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.tasks.actions import build_trigger_action_task_params, trigger_action
from sentry.workflow_engine.tasks.utils import retry_timeouts
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger("sentry.workflow_engine.processors.delayed_workflow")

EVENT_LIMIT = 100
COMPARISON_INTERVALS_VALUES = {k: v[1] for k, v in COMPARISON_INTERVALS.items()}

GroupId: TypeAlias = int
DataConditionGroupId: TypeAlias = int
WorkflowId: TypeAlias = int


class EventInstance(BaseModel):
    event_id: str
    occurrence_id: str | None = None
    timestamp: datetime | None = None

    class Config:
        # Ignore unknown fields; we'd like to be able to add new fields easily.
        extra = "ignore"

    @validator("event_id")
    def validate_event_id(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("event_id is required")
        return v

    @validator("occurrence_id")
    def validate_occurrence_id(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            return None
        return v


@dataclass(frozen=True)
class EventKey:
    """
    A key for an event in the Redis buffer.
    """

    workflow_id: WorkflowId
    group_id: GroupId
    dcg_ids: frozenset[DataConditionGroupId]
    dcg_type: DataConditionHandler.Group
    original_key: str

    @classmethod
    def from_redis_key(cls, key: str) -> EventKey:
        parts = key.split(":")
        return cls(
            workflow_id=int(parts[0]),
            group_id=int(parts[1]),
            dcg_ids=frozenset(int(dcg_id) for dcg_id in parts[2].split(",")),
            dcg_type=DataConditionHandler.Group(parts[3]),
            original_key=key,
        )

    def __str__(self) -> str:
        return self.original_key

    def __hash__(self) -> int:
        return hash(self.original_key)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, EventKey):
            return NotImplemented
        return self.original_key == other.original_key


@dataclass(frozen=True)
class EventRedisData:
    """
    Immutable container for all data from Redis.
    Any lookups or summaries or other processing that can be purely derived
    from the data should be done on this object so that it's obvious where we're operating
    based on parameter data.
    """

    events: Mapping[EventKey, EventInstance]

    @classmethod
    def from_redis_data(
        cls, redis_data: dict[str, str], *, continue_on_error: bool
    ) -> EventRedisData:
        events = {}
        for key, value in redis_data.items():
            try:
                event_key = EventKey.from_redis_key(key)
                event_instance = EventInstance.parse_raw(value)
                events[event_key] = event_instance
            except Exception as e:
                logger.exception(
                    "Failed to parse workflow event data",
                    extra={"key": key, "value": value, "error": str(e)},
                )
                if not continue_on_error:
                    raise ValueError(f"Failed to parse Redis data: {str(e)}") from e
        return cls(events=events)

    @cached_property
    def dcg_ids(self) -> set[DataConditionGroupId]:
        return {dcg_id for key in self.events for dcg_id in key.dcg_ids}

    @cached_property
    def dcg_to_groups(self) -> Mapping[DataConditionGroupId, set[GroupId]]:
        dcg_to_groups: dict[DataConditionGroupId, set[GroupId]] = defaultdict(set)
        for key in self.events:
            for dcg_id in key.dcg_ids:
                dcg_to_groups[dcg_id].add(key.group_id)
        return dcg_to_groups

    @cached_property
    def trigger_group_to_dcg_model(
        self,
    ) -> dict[DataConditionHandler.Group, dict[DataConditionGroupId, WorkflowId]]:
        trigger_group_to_dcg_model: dict[
            DataConditionHandler.Group, dict[DataConditionGroupId, WorkflowId]
        ] = defaultdict(dict)
        for key in self.events:
            for dcg_id in key.dcg_ids:
                trigger_group_to_dcg_model[key.dcg_type][dcg_id] = key.workflow_id
        return trigger_group_to_dcg_model

    @cached_property
    def dcg_to_workflow(self) -> dict[DataConditionGroupId, WorkflowId]:
        """Get mapping of DCG IDs to workflow IDs, combining both trigger and action filter groups."""
        return {
            **self.trigger_group_to_dcg_model[DataConditionHandler.Group.WORKFLOW_TRIGGER],
            **self.trigger_group_to_dcg_model[DataConditionHandler.Group.ACTION_FILTER],
        }

    @cached_property
    def workflow_ids(self) -> set[WorkflowId]:
        return {key.workflow_id for key in self.events}

    @cached_property
    def event_ids(self) -> set[str]:
        return {instance.event_id for instance in self.events.values() if instance.event_id}

    @cached_property
    def occurrence_ids(self) -> set[str]:
        return {
            instance.occurrence_id for instance in self.events.values() if instance.occurrence_id
        }

    @cached_property
    def group_ids(self) -> set[GroupId]:
        return {key.group_id for key in self.events}

    @cached_property
    def dcg_to_timestamp(self) -> dict[int, datetime | None]:
        """
        A DCG can be recorded with an event for later processing multiple times.
        We need to pick a time to use when processing them in bulk, so to bias for recency we associate each DCG with the latest timestamp.
        """
        result: dict[int, datetime | None] = defaultdict(lambda: None)

        for key, instance in self.events.items():
            timestamp = instance.timestamp
            for dcg_id in key.dcg_ids:
                existing_timestamp = result[dcg_id]
                if timestamp is None:
                    continue
                elif existing_timestamp is not None and timestamp > existing_timestamp:
                    result[dcg_id] = timestamp
        return result


@dataclass
class GroupQueryParams:
    """
    Parameters to query a UniqueConditionQuery with in Snuba.
    """

    group_ids: set[GroupId] = field(default_factory=set)
    timestamp: datetime | None = None

    def update(self, group_ids: set[GroupId], timestamp: datetime | None) -> None:
        """
        Use the latest timestamp for a set of group IDs with the same Snuba query.
        We will query backwards in time from this point.
        """
        self.group_ids.update(group_ids)

        if timestamp is not None:
            self.timestamp = timestamp if self.timestamp is None else max(timestamp, self.timestamp)


@dataclass(frozen=True)
class UniqueConditionQuery:
    """
    Represents all the data that uniquely identifies a condition and its
    single respective Snuba query that must be made. Multiple instances of the
    same condition can share a single query.
    """

    handler: type[BaseEventFrequencyQueryHandler]
    interval: str
    environment_id: int | None
    comparison_interval: str | None = None
    # Hashable representation of the filters
    frozen_filters: Sequence[frozenset[tuple[str, Any]]] | None = None

    @staticmethod
    def freeze_filters(
        filters: Sequence[Mapping[str, Any]] | None,
    ) -> Sequence[frozenset[tuple[str, Any]]] | None:
        """
        Convert the sorted representation of filters into a frozen one that can
        be safely hashed.
        """
        if filters is None:
            return None
        return tuple(frozenset(sorted(filter.items())) for filter in filters)

    @property
    def filters(self) -> list[QueryFilter] | None:
        if self.frozen_filters is None:
            return None
        return [dict(filter) for filter in self.frozen_filters]

    def __repr__(self) -> str:
        return f"UniqueConditionQuery(handler={self.handler.__name__}, interval={self.interval}, environment_id={self.environment_id}, comparison_interval={self.comparison_interval}, filters={self.filters})"


def fetch_project(project_id: int) -> Project | None:
    try:
        return Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.info(
            "delayed_processing.project_does_not_exist",
            extra={"project_id": project_id},
        )
        return None


def fetch_group_to_event_data(
    project_id: int, model: type[models.Model], batch_key: str | None = None
) -> dict[str, str]:
    field: dict[str, models.Model | int | str] = {
        "project_id": project_id,
    }

    if batch_key:
        field["batch_key"] = batch_key

    return buffer.backend.get_hash(model=model, field=field)


def fetch_workflows_envs(
    workflow_ids: list[WorkflowId],
) -> Mapping[WorkflowId, int | None]:
    return {
        workflow_id: env_id
        for workflow_id, env_id in Workflow.objects.filter(id__in=workflow_ids).values_list(
            "id", "environment_id"
        )
    }


def fetch_data_condition_groups(
    dcg_ids: list[DataConditionGroupId],
) -> list[DataConditionGroup]:
    """
    Fetch DataConditionGroups with enabled detectors/workflows
    """

    return list(DataConditionGroup.objects.filter(id__in=dcg_ids))


def generate_unique_queries(
    condition: DataCondition, environment_id: int | None
) -> list[UniqueConditionQuery]:
    """
    Returns a list of all unique condition queries that must be made for the
    given condition instance.
    Count comparison conditions will only have one unique query, while percent
    comparison conditions will have two unique queries.
    """

    try:
        condition_type = Condition(condition.type)
    except ValueError:
        logger.exception(
            "Invalid condition type",
            extra={"type": condition.type, "id": condition.id},
        )
        return []

    if condition_type not in SLOW_CONDITIONS:
        return []

    try:
        handler = slow_condition_query_handler_registry.get(condition_type)
    except NoRegistrationExistsError:
        logger.exception(
            "No registration exists for condition",
            extra={"type": condition.type, "id": condition.id},
        )
        return []

    unique_queries = [
        UniqueConditionQuery(
            handler=handler,
            interval=condition.comparison["interval"],
            environment_id=environment_id,
            frozen_filters=UniqueConditionQuery.freeze_filters(condition.comparison.get("filters")),
        )
    ]
    if condition_type in PERCENT_CONDITIONS:
        unique_queries.append(
            UniqueConditionQuery(
                handler=handler,
                interval=condition.comparison["interval"],
                environment_id=environment_id,
                comparison_interval=condition.comparison.get("comparison_interval"),
                frozen_filters=UniqueConditionQuery.freeze_filters(
                    condition.comparison.get("filters")
                ),
            )
        )
    return unique_queries


@sentry_sdk.trace
def get_condition_query_groups(
    data_condition_groups: list[DataConditionGroup],
    event_data: EventRedisData,
    workflows_to_envs: Mapping[WorkflowId, int | None],
    dcg_to_slow_conditions: dict[DataConditionGroupId, list[DataCondition]],
) -> dict[UniqueConditionQuery, GroupQueryParams]:
    """
    Map unique condition queries to the group IDs that need to checked for that query.
    """
    condition_groups: dict[UniqueConditionQuery, GroupQueryParams] = defaultdict(GroupQueryParams)

    for dcg in data_condition_groups:
        slow_conditions = dcg_to_slow_conditions[dcg.id]
        workflow_id = event_data.dcg_to_workflow.get(dcg.id)
        workflow_env = workflows_to_envs[workflow_id] if workflow_id else None
        timestamp = event_data.dcg_to_timestamp[dcg.id]
        for condition in slow_conditions:
            for condition_query in generate_unique_queries(condition, workflow_env):
                condition_groups[condition_query].update(
                    group_ids=event_data.dcg_to_groups[dcg.id], timestamp=timestamp
                )
    return condition_groups


@metrics.wraps(
    "workflow_engine.delayed_workflow.get_condition_group_results",
    # We want this to be accurate enough for alerting, so sample 100%
    sample_rate=1.0,
)
def get_condition_group_results(
    queries_to_groups: dict[UniqueConditionQuery, GroupQueryParams],
) -> dict[UniqueConditionQuery, QueryResult]:
    condition_group_results = {}
    current_time = timezone.now()

    all_group_ids: set[GroupId] = set()
    # bulk gather groups and fetch them
    for time_and_groups in queries_to_groups.values():
        all_group_ids.update(time_and_groups.group_ids)

    all_groups: list[GroupValues] = list(
        Group.objects.filter(id__in=all_group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
    )

    for unique_condition, time_and_groups in queries_to_groups.items():
        handler = unique_condition.handler()
        group_ids = time_and_groups.group_ids
        groups_to_query = [group for group in all_groups if group["id"] in group_ids]
        time = time_and_groups.timestamp or current_time

        _, duration = handler.intervals[unique_condition.interval]

        comparison_interval: timedelta | None = None
        if unique_condition.comparison_interval is not None:
            comparison_interval = COMPARISON_INTERVALS_VALUES.get(
                unique_condition.comparison_interval
            )

        result = handler.get_rate_bulk(
            duration=duration,
            groups=groups_to_query,
            environment_id=unique_condition.environment_id,
            current_time=time,
            comparison_interval=comparison_interval,
            filters=unique_condition.filters,
        )
        absent_group_ids = group_ids - set(result.keys())
        if absent_group_ids:
            logger.warning(
                "workflow_engine.delayed_workflow.absent_group_ids",
                extra={"group_ids": absent_group_ids, "unique_condition": unique_condition},
            )
        condition_group_results[unique_condition] = result

    return condition_group_results


@sentry_sdk.trace
def get_groups_to_fire(
    data_condition_groups: list[DataConditionGroup],
    workflows_to_envs: Mapping[WorkflowId, int | None],
    event_data: EventRedisData,
    condition_group_results: dict[UniqueConditionQuery, QueryResult],
    dcg_to_slow_conditions: dict[DataConditionGroupId, list[DataCondition]],
) -> dict[GroupId, set[DataConditionGroup]]:
    groups_to_fire: dict[GroupId, set[DataConditionGroup]] = defaultdict(set)

    for dcg in data_condition_groups:
        slow_conditions = dcg_to_slow_conditions[dcg.id]
        action_match = DataConditionGroup.Type(dcg.logic_type)
        workflow_id = event_data.dcg_to_workflow.get(dcg.id)
        workflow_env = workflows_to_envs[workflow_id] if workflow_id else None

        for group_id in event_data.dcg_to_groups[dcg.id]:
            conditions_to_evaluate: list[tuple[DataCondition, list[int | float]]] = []
            for condition in slow_conditions:
                unique_queries = generate_unique_queries(condition, workflow_env)
                query_values = [
                    condition_group_results[unique_query][group_id]
                    for unique_query in unique_queries
                ]
                conditions_to_evaluate.append((condition, query_values))

            evaluation = evaluate_data_conditions(conditions_to_evaluate, action_match)
            if (
                evaluation.logic_result and workflow_id is None
            ):  # TODO: detector trigger passes. do something like create issue
                pass
            elif evaluation.logic_result:
                groups_to_fire[group_id].add(dcg)

    return groups_to_fire


def bulk_fetch_events(event_ids: list[str], project_id: int) -> dict[str, Event]:
    node_id_to_event_id = {
        Event.generate_node_id(project_id, event_id=event_id): event_id for event_id in event_ids
    }
    node_ids = list(node_id_to_event_id.keys())
    fetch_retry_policy = ConditionalRetryPolicy(should_retry_fetch, exponential_delay(1.00))

    bulk_data = {}
    for node_id_chunk in chunked(node_ids, EVENT_LIMIT):
        bulk_results = fetch_retry_policy(lambda: nodestore.backend.get_multi(node_id_chunk))
        bulk_data.update(bulk_results)

    return {
        node_id_to_event_id[node_id]: Event(
            event_id=node_id_to_event_id[node_id], project_id=project_id, data=data
        )
        for node_id, data in bulk_data.items()
        if data is not None
    }


@sentry_sdk.trace
def get_group_to_groupevent(
    event_data: EventRedisData,
    groups_to_dcgs: dict[GroupId, set[DataConditionGroup]],
    project_id: int,
) -> dict[Group, GroupEvent]:
    groups = Group.objects.filter(id__in=event_data.group_ids)
    group_id_to_group = {group.id: group for group in groups}

    bulk_event_id_to_events = bulk_fetch_events(list(event_data.event_ids), project_id)
    bulk_occurrences = IssueOccurrence.fetch_multi(
        list(event_data.occurrence_ids), project_id=project_id
    )

    bulk_occurrence_id_to_occurrence = {
        occurrence.id: occurrence for occurrence in bulk_occurrences if occurrence
    }

    groups_to_dcg_ids = {
        group_id: {dcg.id for dcg in dcgs} for group_id, dcgs in groups_to_dcgs.items()
    }

    group_to_groupevent: dict[Group, GroupEvent] = {}
    for key, instance in event_data.events.items():
        if key.dcg_ids.intersection(groups_to_dcg_ids.get(key.group_id, set())):
            event = bulk_event_id_to_events.get(instance.event_id)
            group = group_id_to_group.get(key.group_id)

            if not group or not event:
                continue

            group_event = event.for_group(group)
            if instance.occurrence_id:
                group_event.occurrence = bulk_occurrence_id_to_occurrence.get(
                    instance.occurrence_id
                )
            group_to_groupevent[group] = group_event

    return group_to_groupevent


def get_dcgs_by_group(
    groups_to_fire: dict[GroupId, set[DataConditionGroup]],
    event_data: EventRedisData,
    dcg_type: DataConditionHandler.Group,
) -> dict[GroupId, set[DataConditionGroup]]:
    """
    Extract DataConditionGroups from groups_to_fire, grouped by group ID, for a particular DataConditionGroup type (e.g. workflow trigger)
    trigger_group_to_dcg_model is the mapping from DataConditionGroup type to DataConditionGroup id to Workflow id
    Returns a dict mapping GroupId to set of DCGs.
    """
    workflow_dcg_ids = set(event_data.trigger_group_to_dcg_model[dcg_type].keys())

    workflow_dcgs_by_group = {}
    for group_id, dcgs in groups_to_fire.items():
        workflow_dcgs = {dcg for dcg in dcgs if dcg.id in workflow_dcg_ids}
        if workflow_dcgs:
            workflow_dcgs_by_group[group_id] = workflow_dcgs

    return workflow_dcgs_by_group


@sentry_sdk.trace
def fire_actions_for_groups(
    organization: Organization,
    groups_to_fire: dict[GroupId, set[DataConditionGroup]],
    event_data: EventRedisData,
    group_to_groupevent: dict[Group, GroupEvent],
) -> None:
    serialized_groups = {
        group.id: group_event.event_id for group, group_event in group_to_groupevent.items()
    }
    logger.info(
        "workflow_engine.delayed_workflow.fire_actions_for_groups",
        extra={
            "groups_to_fire": groups_to_fire,
            "group_to_groupevent": serialized_groups,
        },
    )

    workflow_triggers = get_dcgs_by_group(
        groups_to_fire, event_data, DataConditionHandler.Group.WORKFLOW_TRIGGER
    )
    action_filters = get_dcgs_by_group(
        groups_to_fire, event_data, DataConditionHandler.Group.ACTION_FILTER
    )
    all_workflow_triggers = set().union(*list(workflow_triggers.values()))

    # Bulk fetch detectors
    event_id_to_detector = get_detectors_by_groupevents_bulk(list(group_to_groupevent.values()))

    # Bulk fetch action filters for workflow triggers
    workflows = Workflow.objects.filter(when_condition_group_id__in=all_workflow_triggers)

    dcg_to_workflow = {
        wdcg.condition_group: wdcg.workflow
        for wdcg in WorkflowDataConditionGroup.objects.select_related(
            "workflow", "condition_group"
        ).filter(workflow__in=workflows)
    }

    # Feature check caching to keep us within the trace budget.
    should_trigger_actions = features.has(
        "organizations:workflow-engine-trigger-actions", organization
    )
    should_trigger_actions_async = features.has(
        "organizations:workflow-engine-action-trigger-async", organization
    )

    total_actions = 0
    with track_batch_performance(
        "workflow_engine.delayed_workflow.fire_actions_for_groups.loop",
        logger,
        threshold=timedelta(seconds=40),
    ) as tracker:
        for group, group_event in group_to_groupevent.items():
            with tracker.track(str(group.id)), log_context.new_context(group_id=group.id):
                workflow_event_data = WorkflowEventData(event=group_event, group=group)
                detector = event_id_to_detector.get(group_event.event_id)

                if detector is None:
                    logger.warning(
                        "No detector found for event, skipping",
                        extra={
                            "event_id": group_event.event_id,
                            "group_id": group.id,
                        },
                    )
                    continue

                workflow_triggers_for_group = workflow_triggers.get(group.id, set())
                action_filters_for_group = action_filters.get(group.id, set())

                with log_if_slow(
                    logger,
                    "workflow_engine.delayed_workflow.slow_evaluate_workflows_action_filters",
                    extra={"event_data": workflow_event_data},
                    threshold_seconds=1,
                ):
                    # Process workflow filters for passing trigger groups
                    triggered_workflow_ids = {
                        event_data.dcg_to_workflow[dcg.id] for dcg in workflow_triggers_for_group
                    }

                    filter_dcg_to_workflow: dict[DataConditionGroup, Workflow] = {
                        dcg: workflow
                        for dcg, workflow in dcg_to_workflow.items()
                        if workflow.id in triggered_workflow_ids
                    }

                    workflows_actions = evaluate_action_filters(
                        workflow_event_data,
                        filter_dcg_to_workflow,
                    )

                filtered_actions = filter_recently_fired_workflow_actions(
                    action_filters_for_group | workflows_actions, workflow_event_data
                )
                create_workflow_fire_histories(detector, filtered_actions, workflow_event_data)

                metrics.incr(
                    "workflow_engine.delayed_workflow.triggered_actions",
                    amount=len(filtered_actions),
                    tags={"event_type": group_event.group.type},
                )

                event_id = (
                    workflow_event_data.event.event_id
                    if isinstance(workflow_event_data.event, GroupEvent)
                    else workflow_event_data.event.id
                )
                logger.debug(
                    "workflow_engine.delayed_workflow.triggered_actions",
                    extra={
                        "workflow_ids": triggered_workflow_ids,
                        "actions": [action.id for action in filtered_actions],
                        "event_data": workflow_event_data,
                        "event_id": event_id,
                    },
                )
                total_actions += len(filtered_actions)

                if should_trigger_actions:
                    for action in filtered_actions:
                        if should_trigger_actions_async:
                            task_params = build_trigger_action_task_params(
                                action, detector, workflow_event_data
                            )
                            trigger_action.delay(**task_params)
                        else:
                            action.trigger(workflow_event_data, detector)

    logger.info(
        "workflow_engine.delayed_workflow.triggered_actions_summary",
        extra={"total_actions": total_actions},
    )


@sentry_sdk.trace
def cleanup_redis_buffer(
    project_id: int, event_keys: Iterable[EventKey], batch_key: str | None
) -> None:
    hashes_to_delete = [key.original_key for key in event_keys]
    filters: dict[str, BufferField] = {"project_id": project_id}
    if batch_key:
        filters["batch_key"] = batch_key

    buffer.backend.delete_hash(model=Workflow, filters=filters, fields=hashes_to_delete)


def repr_keys[T, V](d: dict[T, V]) -> dict[str, V]:
    return {repr(key): value for key, value in d.items()}


@instrumented_task(
    name="sentry.workflow_engine.processors.delayed_workflow",
    queue="delayed_rules",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
@retry
@retry_timeouts
@log_context.root()
def process_delayed_workflows(
    project_id: int, batch_key: str | None = None, *args: Any, **kwargs: Any
) -> None:
    """
    Grab workflows, groups, and data condition groups from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    log_context.add_extras(project_id=project_id)
    with sentry_sdk.start_span(op="delayed_workflow.prepare_data"):
        project = fetch_project(project_id)
        if not project:
            return

        redis_data = fetch_group_to_event_data(project_id, Workflow, batch_key)
        event_data = EventRedisData.from_redis_data(redis_data, continue_on_error=True)

        metrics.incr(
            "workflow_engine.delayed_workflow",
            amount=len(event_data.events),
        )

        workflows_to_envs = fetch_workflows_envs(list(event_data.workflow_ids))
        data_condition_groups = fetch_data_condition_groups(list(event_data.dcg_ids))
        dcg_to_slow_conditions = get_slow_conditions_for_groups(list(event_data.dcg_ids))

        no_slow_condition_groups = {
            dcg_id for dcg_id, slow_conds in dcg_to_slow_conditions.items() if not slow_conds
        }
        if no_slow_condition_groups:
            # If the DCG is being processed here, it's because we thought it had a slow condition.
            # If any don't seem to have a slow condition now, that's interesting enough to log.
            logger.info(
                "delayed_workflow.no_slow_condition_groups",
                extra={"no_slow_condition_groups": sorted(no_slow_condition_groups)},
            )

    logger.info(
        "delayed_workflow.workflows",
        extra={
            "data": redis_data,
            "workflows": event_data.workflow_ids,
        },
    )

    # Get unique query groups to query Snuba
    condition_groups = get_condition_query_groups(
        data_condition_groups, event_data, workflows_to_envs, dcg_to_slow_conditions
    )
    if not condition_groups:
        return
    logger.info(
        "delayed_workflow.condition_query_groups",
        extra={
            "condition_groups": repr_keys(condition_groups),
            "num_condition_groups": len(condition_groups),
        },
    )

    try:
        condition_group_results = get_condition_group_results(condition_groups)
    except SnubaError:
        # We expect occasional errors, so we report as warning and retry.
        logger.warning("delayed_workflow.snuba_error", exc_info=True)
        retry_task()

    logger.info(
        "delayed_workflow.condition_group_results",
        extra={
            "condition_group_results": repr_keys(condition_group_results),
        },
    )

    # Evaluate DCGs
    groups_to_dcgs = get_groups_to_fire(
        data_condition_groups,
        workflows_to_envs,
        event_data,
        condition_group_results,
        dcg_to_slow_conditions,
    )
    logger.info(
        "delayed_workflow.groups_to_fire",
        extra={"groups_to_dcgs": groups_to_dcgs},
    )

    group_to_groupevent = get_group_to_groupevent(
        event_data,
        groups_to_dcgs,
        project_id,
    )

    fire_actions_for_groups(project.organization, groups_to_dcgs, event_data, group_to_groupevent)
    cleanup_redis_buffer(project_id, event_data.events.keys(), batch_key)


@delayed_processing_registry.register("delayed_workflow")
class DelayedWorkflow(DelayedProcessingBase):
    buffer_key = WORKFLOW_ENGINE_BUFFER_LIST_KEY
    option = "delayed_workflow.rollout"

    @property
    def hash_args(self) -> BufferHashKeys:
        return BufferHashKeys(model=Workflow, filters=FilterKeys(project_id=self.project_id))

    @property
    def processing_task(self) -> Task:
        return process_delayed_workflows

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import cached_property
from typing import Any, TypeAlias

import sentry_sdk
from django.utils import timezone
from pydantic import BaseModel, validator

from sentry import features, nodestore, options
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.rules.conditions.event_frequency import COMPARISON_INTERVALS
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.tasks.post_process import should_retry_fetch
from sentry.taskworker.retry import retry_task
from sentry.taskworker.state import current_task
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.registry import NoRegistrationExistsError
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.snuba import RateLimitExceeded, SnubaError
from sentry.workflow_engine.buffer.batch_client import (
    DelayedWorkflowClient,
    ProjectDelayedWorkflowClient,
)
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
from sentry.workflow_engine.processors.data_condition_group import (
    TriggerResult,
    evaluate_data_conditions,
    get_slow_conditions_for_groups,
)
from sentry.workflow_engine.processors.log_util import track_batch_performance
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.types import ConditionError, WorkflowEventData
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

    # workflow WHEN DataConditionGroupId with slow condition(s)
    when_dcg_id: DataConditionGroupId | None

    # workflow IF DataConditionGroupIds with slow condition(s)
    if_dcg_ids: frozenset[DataConditionGroupId]

    # workflow IF DataConditionGroupIds without slow conditions
    # these depend on the WHEN DataConditionGroup passing to fire
    passing_dcg_ids: frozenset[DataConditionGroupId]

    # original key from Redis
    original_key: str

    @classmethod
    def from_redis_key(cls, key: str) -> EventKey:
        parts = key.split(":")
        if len(parts) != 5:
            raise ValueError(f"Invalid key: {key}")
        return cls(
            workflow_id=int(parts[0]),
            group_id=int(parts[1]),
            when_dcg_id=int(parts[2]) if parts[2] else None,
            if_dcg_ids=frozenset(int(dcg_id) for dcg_id in parts[3].split(",") if dcg_id),
            passing_dcg_ids=frozenset(int(dcg_id) for dcg_id in parts[4].split(",") if dcg_id),
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

    @cached_property
    def dcg_ids(self) -> set[DataConditionGroupId]:
        ids = {self.when_dcg_id} if self.when_dcg_id else set()
        ids.update(id for id in self.if_dcg_ids)
        ids.update(id for id in self.passing_dcg_ids)
        return ids


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
        return {id for key in self.events for id in key.dcg_ids}

    @cached_property
    def dcg_to_groups(self) -> Mapping[DataConditionGroupId, set[GroupId]]:
        dcg_to_groups: dict[DataConditionGroupId, set[GroupId]] = defaultdict(set)
        for key in self.events:
            for dcg_id in key.dcg_ids:
                dcg_to_groups[dcg_id].add(key.group_id)
        return dcg_to_groups

    @cached_property
    def dcg_to_workflow(self) -> dict[DataConditionGroupId, WorkflowId]:
        """Get mapping of DCG IDs to workflow IDs, combining both trigger and action filter groups."""
        dcg_to_workflow = {}
        for key in self.events:
            for dcg_id in key.dcg_ids:
                dcg_to_workflow[dcg_id] = key.workflow_id

        return dcg_to_workflow

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
        result: dict[int, datetime | None] = {}

        for key, instance in self.events.items():
            timestamp = instance.timestamp
            if timestamp is None:
                continue
            for dcg_id in key.dcg_ids:
                existing_timestamp = result.get(dcg_id)
                if existing_timestamp is None or timestamp > existing_timestamp:
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
    now = timezone.now()
    for dcg in data_condition_groups:
        slow_conditions = dcg_to_slow_conditions[dcg.id]
        workflow_id = event_data.dcg_to_workflow.get(dcg.id)
        workflow_env = workflows_to_envs[workflow_id] if workflow_id else None
        timestamp = event_data.dcg_to_timestamp.get(dcg.id)
        if timestamp is not None:
            delay = now - timestamp
            # If it's been more than 1.5 minutes, we're taking too long to process the event and
            # want to know how bad it is. It's a biased sample, but let's us see if we've somewhat
            # over or very over.
            if delay.total_seconds() > 90:
                metrics.timing(
                    "workflow_engine.overdue_event_lag",
                    delay.total_seconds(),
                    sample_rate=1.0,
                )
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
@sentry_sdk.trace
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

    last_try = False
    if task := current_task():
        last_try = not task.retries_remaining

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

        try:
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
        except RateLimitExceeded as e:
            # If we're on our final attempt and encounter a rate limit error, we log it and continue.
            # The condition will evaluate as false, which may be wrong, but this is better for users
            # than allowing the whole task to fail.
            if last_try:
                logger.info("delayed_workflow.snuba_rate_limit_exceeded", extra={"error": e})
            else:
                raise

    return condition_group_results


class MissingQueryResult(Exception):
    """
    Raised when a group is missing from a query result.
    """

    def __init__(
        self, group_id: GroupId, query: UniqueConditionQuery, query_result: QueryResult | None
    ):
        self.group_id = group_id
        self.query = query
        self.query_result = query_result


def _evaluate_group_result_for_dcg(
    dcg: DataConditionGroup,
    dcg_to_slow_conditions: dict[DataConditionGroupId, list[DataCondition]],
    group_id: GroupId,
    workflow_env: int | None,
    condition_group_results: dict[UniqueConditionQuery, QueryResult],
) -> TriggerResult:
    slow_conditions = dcg_to_slow_conditions[dcg.id]
    try:
        return _group_result_for_dcg(
            group_id, dcg, workflow_env, condition_group_results, slow_conditions
        )
    except MissingQueryResult as e:
        # If we didn't get complete query results, don't fire.
        metrics.incr(
            "workflow_engine.delayed_workflow.missing_query_result",
            tags={"got_result": bool(e.query_result)},
            sample_rate=1.0,
        )
        logger.warning("workflow_engine.delayed_workflow.missing_query_result", exc_info=True)
        return TriggerResult(triggered=False, error=ConditionError(msg="Missing query result"))


def _group_result_for_dcg(
    group_id: GroupId,
    dcg: DataConditionGroup,
    workflow_env: int | None,
    condition_group_results: dict[UniqueConditionQuery, QueryResult],
    slow_conditions: list[DataCondition],
) -> TriggerResult:
    conditions_to_evaluate: list[tuple[DataCondition, list[int | float]]] = []
    for condition in slow_conditions:
        query_values = []
        for query in generate_unique_queries(condition, workflow_env):
            query_result = condition_group_results.get(query)
            if not query_result or group_id not in query_result:
                raise MissingQueryResult(group_id, query, query_result)

            query_values.append(query_result[group_id])
        conditions_to_evaluate.append((condition, query_values))

    return evaluate_data_conditions(
        conditions_to_evaluate, DataConditionGroup.Type(dcg.logic_type)
    ).logic_result


@dataclass(frozen=True)
class _ConditionEvaluationStats:
    tainted: int
    untainted: int


@sentry_sdk.trace
def get_groups_to_fire(
    data_condition_groups: list[DataConditionGroup],
    workflows_to_envs: Mapping[WorkflowId, int | None],
    event_data: EventRedisData,
    condition_group_results: dict[UniqueConditionQuery, QueryResult],
    dcg_to_slow_conditions: dict[DataConditionGroupId, list[DataCondition]],
) -> tuple[dict[GroupId, set[DataConditionGroup]], _ConditionEvaluationStats]:
    data_condition_group_mapping = {dcg.id: dcg for dcg in data_condition_groups}
    groups_to_fire: dict[GroupId, set[DataConditionGroup]] = defaultdict(set)

    tainted, untainted = 0, 0
    for event_key in event_data.events:
        group_id = event_key.group_id
        if event_key.workflow_id not in workflows_to_envs:
            # The workflow is deleted, so we can skip it
            continue

        workflow_env = workflows_to_envs[event_key.workflow_id]
        when_result = TriggerResult.TRUE
        if when_dcg_id := event_key.when_dcg_id:
            when_dcg = data_condition_group_mapping.get(when_dcg_id)
            if not when_dcg:
                continue
            when_result = _evaluate_group_result_for_dcg(
                when_dcg,
                dcg_to_slow_conditions,
                group_id,
                workflow_env,
                condition_group_results,
            )
            if not when_result.triggered:
                # If we're not triggering, all action-y if conditions need to be treated
                # as tainted or not based on the when condition result.
                if_conds = event_key.if_dcg_ids | event_key.passing_dcg_ids
                # Limit to those we can access to be consistent with the if conditions evaluation.
                if_cond_count = len(if_conds & data_condition_group_mapping.keys())
                if when_result.is_tainted():
                    tainted += if_cond_count
                else:
                    untainted += if_cond_count
                continue

        # the WHEN condition passed / was not evaluated, so we can now check the IF conditions
        for if_dcg_id in event_key.if_dcg_ids:
            if dcg := data_condition_group_mapping.get(if_dcg_id):
                if_result = when_result & _evaluate_group_result_for_dcg(
                    dcg,
                    dcg_to_slow_conditions,
                    group_id,
                    workflow_env,
                    condition_group_results,
                )
                if if_result.is_tainted():
                    tainted += 1
                else:
                    untainted += 1
                if if_result.triggered:
                    groups_to_fire[group_id].add(dcg)

        for if_dcg_id in event_key.passing_dcg_ids:
            if dcg := data_condition_group_mapping.get(if_dcg_id):
                # TODO: Propagate taint with passing conditions.
                if when_result.is_tainted():
                    tainted += 1
                else:
                    untainted += 1
                groups_to_fire[group_id].add(dcg)

    return groups_to_fire, _ConditionEvaluationStats(tainted=tainted, untainted=untainted)


@sentry_sdk.trace
def bulk_fetch_events(event_ids: list[str], project: Project) -> dict[str, Event]:
    node_id_to_event_id = {
        Event.generate_node_id(project.id, event_id=event_id): event_id for event_id in event_ids
    }
    node_ids = list(node_id_to_event_id.keys())
    fetch_retry_policy = ConditionalRetryPolicy(should_retry_fetch, exponential_delay(1.00))

    bulk_data = {}
    for node_id_chunk in chunked(node_ids, EVENT_LIMIT):
        with metrics.timer("workflow_engine.process_workflows.fetch_from_nodestore"):
            bulk_results = fetch_retry_policy(lambda: nodestore.backend.get_multi(node_id_chunk))
        bulk_data.update(bulk_results)

    result: dict[str, Event] = {}
    for node_id, data in bulk_data.items():
        if data is not None:
            event = Event(event_id=node_id_to_event_id[node_id], project_id=project.id, data=data)
            # By setting a shared Project, we can ensure that the common pattern of retrieving
            # the project (and fields thereof) from individual events doesn't duplicate work.
            event.project = project
            result[event.event_id] = event
    return result


@metrics.wraps(
    "workflow_engine.delayed_workflow.get_group_to_groupevent",
    sample_rate=1.0,
)
@sentry_sdk.trace
def get_group_to_groupevent(
    event_data: EventRedisData,
    groups_to_dcgs: dict[GroupId, set[DataConditionGroup]],
    project: Project,
) -> dict[Group, tuple[GroupEvent, datetime | None]]:
    groups = Group.objects.filter(id__in=event_data.group_ids)
    group_id_to_group = {group.id: group for group in groups}

    bulk_event_id_to_events = bulk_fetch_events(list(event_data.event_ids), project)
    bulk_occurrences: list[IssueOccurrence | None] = []
    if event_data.occurrence_ids:
        bulk_occurrences = IssueOccurrence.fetch_multi(
            list(event_data.occurrence_ids), project_id=project.id
        )

    bulk_occurrence_id_to_occurrence = {
        occurrence.id: occurrence for occurrence in bulk_occurrences if occurrence
    }

    groups_to_dcg_ids = {
        group_id: {dcg.id for dcg in dcgs} for group_id, dcgs in groups_to_dcgs.items()
    }

    group_to_groupevent: dict[Group, tuple[GroupEvent, datetime | None]] = {}
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
            group_to_groupevent[group] = (group_event, instance.timestamp)

    return group_to_groupevent


@sentry_sdk.trace
def fire_actions_for_groups(
    organization: Organization,
    groups_to_fire: dict[GroupId, set[DataConditionGroup]],
    group_to_groupevent: dict[Group, tuple[GroupEvent, datetime | None]],
) -> None:
    from sentry.workflow_engine.processors.action import (
        filter_recently_fired_workflow_actions,
        fire_actions,
    )

    serialized_groups = {
        group.id: group_event.event_id for group, (group_event, _) in group_to_groupevent.items()
    }
    logger.info(
        "workflow_engine.delayed_workflow.fire_actions_for_groups",
        extra={
            "groups_to_fire": groups_to_fire,
            "group_to_groupevent": serialized_groups,
        },
    )

    # Feature check caching to keep us within the trace budget.
    single_processing_ff = features.has(
        "organizations:workflow-engine-single-process-workflows", organization
    )
    ga_type_ids = options.get("workflow_engine.issue_alert.group.type_id.ga")
    rollout_type_ids = options.get("workflow_engine.issue_alert.group.type_id.rollout")

    should_trigger_actions = lambda type_id: (
        type_id in ga_type_ids or (type_id in rollout_type_ids and single_processing_ff)
    )

    total_actions = 0
    with track_batch_performance(
        "workflow_engine.delayed_workflow.fire_actions_for_groups.loop",
        logger,
        threshold=timedelta(seconds=40),
    ) as tracker:
        for group, (group_event, start_timestamp) in group_to_groupevent.items():
            with tracker.track(str(group.id)), log_context.new_context(group_id=group.id):
                workflow_event_data = WorkflowEventData(event=group_event, group=group)

                dcgs_for_group = groups_to_fire.get(group.id, set())
                filtered_actions = filter_recently_fired_workflow_actions(
                    dcgs_for_group, workflow_event_data
                )
                # TODO: trigger service hooks from here

                metrics.incr(
                    "workflow_engine.delayed_workflow.triggered_actions",
                    amount=len(filtered_actions),
                    tags={"event_type": group_event.group.type},
                )

                workflow_fire_histories = create_workflow_fire_histories(
                    filtered_actions,
                    workflow_event_data,
                    should_trigger_actions(group_event.group.type),
                    is_delayed=True,
                    start_timestamp=start_timestamp,
                )

                event_id = (
                    workflow_event_data.event.event_id
                    if isinstance(workflow_event_data.event, GroupEvent)
                    else workflow_event_data.event.id
                )
                logger.debug(
                    "workflow_engine.delayed_workflow.triggered_actions",
                    extra={
                        "workflow_ids": sorted(
                            {wfh.workflow_id for wfh in workflow_fire_histories}
                        ),
                        "actions": [action.id for action in filtered_actions],
                        "event_data": workflow_event_data,
                        "event_id": event_id,
                    },
                )
                total_actions += len(filtered_actions)

                fire_actions(filtered_actions, workflow_event_data)

    logger.debug(
        "workflow_engine.delayed_workflow.triggered_actions_summary",
        extra={"total_actions": total_actions},
    )


@sentry_sdk.trace
def cleanup_redis_buffer(
    client: ProjectDelayedWorkflowClient, event_keys: Iterable[EventKey], batch_key: str | None
) -> None:
    client.delete_hash_fields(batch_key=batch_key, fields=[key.original_key for key in event_keys])


def repr_keys[T, V](d: dict[T, V]) -> dict[str, V]:
    return {repr(key): value for key, value in d.items()}


def _summarize_by_first[T1, T2: int | str](it: Iterable[tuple[T1, T2]]) -> dict[T1, list[T2]]:
    "Logging helper to allow pairs to be summarized as a mapping from first to list of second"
    result = defaultdict(set)
    for key, value in it:
        result[key].add(value)
    return {key: sorted(values) for key, values in result.items()}


@sentry_sdk.trace
def process_delayed_workflows(
    batch_client: DelayedWorkflowClient, project_id: int, batch_key: str | None = None
) -> None:
    """
    Grab workflows, groups, and data condition groups from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    with sentry_sdk.start_span(op="delayed_workflow.prepare_data"):
        project = fetch_project(project_id)
        if not project:
            return

        if features.has(
            "organizations:workflow-engine-process-workflows-logs", project.organization
        ):
            log_context.set_verbose(True)

        redis_data = batch_client.for_project(project_id).get_hash_data(batch_key)
        event_data = EventRedisData.from_redis_data(redis_data, continue_on_error=True)

        metrics.incr(
            "workflow_engine.delayed_workflow",
            amount=len(event_data.events),
        )

        workflows_to_envs = fetch_workflows_envs(list(event_data.workflow_ids))
        data_condition_groups = fetch_data_condition_groups(list(event_data.dcg_ids))
        dcg_to_slow_conditions = get_slow_conditions_for_groups(list(event_data.dcg_ids))

    # Ensure we have a record of the involved workflows in our logs.
    logger.debug(
        "delayed_workflow.workflows",
        extra={
            "workflows": sorted(event_data.workflow_ids),
        },
    )
    # Ensure we log which groups/events being processed by which workflows.
    # This is logged independently to avoid the risk of generating log messages that need to be
    # truncated (and thus no longer valid JSON that we can query).
    logger.debug(
        "delayed_workflow.group_events_to_workflow_ids",
        extra={
            "group_events_to_workflow_ids": _summarize_by_first(
                (f"{event_key.group_id}:{instance.event_id}", event_key.workflow_id)
                for event_key, instance in event_data.events.items()
            ),
        },
    )

    # Get unique query groups to query Snuba
    condition_groups = get_condition_query_groups(
        data_condition_groups, event_data, workflows_to_envs, dcg_to_slow_conditions
    )
    if not condition_groups:
        return
    logger.debug(
        "delayed_workflow.condition_query_groups",
        extra={
            "condition_groups": repr_keys(condition_groups),
            "num_condition_groups": len(condition_groups),
        },
    )

    try:
        condition_group_results = get_condition_group_results(condition_groups)
    except SnubaError:
        # We expect occasional errors, so we report as info and retry.
        sentry_sdk.capture_exception(level="info")
        retry_task()

    logger.debug(
        "delayed_workflow.condition_group_results",
        extra={
            "condition_group_results": repr_keys(condition_group_results),
        },
    )

    # Evaluate DCGs
    groups_to_dcgs, trigger_stats = get_groups_to_fire(
        data_condition_groups,
        workflows_to_envs,
        event_data,
        condition_group_results,
        dcg_to_slow_conditions,
    )
    metrics.incr(
        "workflow_engine.delayed_workflow.workflow_if_conditions_evaluated",
        amount=trigger_stats.tainted,
        tags={"tainted": True},
        sample_rate=1.0,
    )
    metrics.incr(
        "workflow_engine.delayed_workflow.workflow_if_conditions_evaluated",
        amount=trigger_stats.untainted,
        tags={"tainted": False},
        sample_rate=1.0,
    )
    logger.debug(
        "delayed_workflow.groups_to_fire",
        extra={
            "groups_to_dcgs": {
                group_id: sorted(dcg.id for dcg in dcgs)
                for group_id, dcgs in groups_to_dcgs.items()
            },
        },
    )

    group_to_groupevent = get_group_to_groupevent(
        event_data,
        groups_to_dcgs,
        project,
    )

    fire_actions_for_groups(project.organization, groups_to_dcgs, group_to_groupevent)
    cleanup_redis_buffer(batch_client.for_project(project_id), event_data.events.keys(), batch_key)

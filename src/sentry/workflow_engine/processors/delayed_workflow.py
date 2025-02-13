import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry import buffer, nodestore
from sentry.db import models
from sentry.eventstore.models import Event, GroupEvent
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.rules.conditions.event_frequency import COMPARISON_INTERVALS
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.post_process import should_retry_fetch
from sentry.utils import json
from sentry.utils.iterators import chunked
from sentry.utils.registry import NoRegistrationExistsError
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.handlers.condition.slow_condition_query_handlers import (
    BaseEventFrequencyQueryHandler,
    slow_condition_query_handler_registry,
)
from sentry.workflow_engine.models import Action, DataCondition, DataConditionGroup, Workflow
from sentry.workflow_engine.models.data_condition import (
    PERCENT_CONDITIONS,
    SLOW_CONDITIONS,
    Condition,
)
from sentry.workflow_engine.models.data_condition_group import get_slow_conditions
from sentry.workflow_engine.processors.action import filter_recently_fired_workflow_actions
from sentry.workflow_engine.processors.data_condition_group import evaluate_data_conditions
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.processors.workflow import evaluate_workflows_action_filters
from sentry.workflow_engine.types import DataConditionHandlerType, WorkflowJob

logger = logging.getLogger("sentry.workflow_engine.processors.delayed_workflow")

EVENT_LIMIT = 100
COMPARISON_INTERVALS_VALUES = {k: v[1] for k, v in COMPARISON_INTERVALS.items()}

DataConditionGroupGroups = dict[int, set[int]]
WorkflowMapping = dict[int, Workflow]
WorkflowEnvMapping = dict[int, int | None]
DataConditionGroupEvent = dict[tuple[int, int], dict[str, str | None]]


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


def fetch_project(project_id: int) -> Project | None:
    try:
        return Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.info(
            "delayed_processing.project_does_not_exist",
            extra={"project_id": project_id},
        )
        return None


# TODO: replace with shared function with delayed_processing.py
def fetch_group_to_event_data(
    project_id: int, model: type[models.Model], batch_key: str | None = None
) -> dict[str, str]:
    field: dict[str, models.Model | int | str] = {
        "project_id": project_id,
    }

    if batch_key:
        field["batch_key"] = batch_key

    return buffer.backend.get_hash(model=model, field=field)


def get_dcg_group_workflow_detector_data(
    workflow_event_dcg_data: dict[str, str]
) -> tuple[DataConditionGroupGroups, dict[DataConditionHandlerType, dict[int, int]]]:
    """
    Parse the data in the buffer hash, which is in the form of {workflow/detector_id}:{group_id}:{dcg_id, ..., dcg_id}:{dcg_type}
    """

    dcg_to_groups: DataConditionGroupGroups = defaultdict(set)
    trigger_type_to_dcg_model: dict[DataConditionHandlerType, dict[int, int]] = defaultdict(dict)

    for workflow_group_dcg, _ in workflow_event_dcg_data.items():
        data = workflow_group_dcg.split(":")
        try:
            dcg_type = DataConditionHandlerType(data[3])
        except ValueError:
            continue

        group_id = int(data[1])
        dcg_ids = [int(dcg_id) for dcg_id in data[2].split(",")]

        for dcg_id in dcg_ids:
            dcg_to_groups[dcg_id].add(group_id)

            trigger_type_to_dcg_model[dcg_type][dcg_id] = int(data[0])

    return dcg_to_groups, trigger_type_to_dcg_model


def fetch_workflows_envs(
    workflow_ids: list[int],
) -> tuple[WorkflowMapping, WorkflowEnvMapping]:
    workflows_to_envs: WorkflowEnvMapping = {}
    workflow_ids_to_workflows: WorkflowMapping = {}

    workflows = list(Workflow.objects.filter(id__in=workflow_ids))

    for workflow in workflows:
        workflows_to_envs[workflow.id] = workflow.environment.id if workflow.environment else None
        workflow_ids_to_workflows[workflow.id] = workflow

    return workflow_ids_to_workflows, workflows_to_envs


def fetch_data_condition_groups(
    dcg_ids: list[int],
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
        )
    ]
    if condition_type in PERCENT_CONDITIONS:
        unique_queries.append(
            UniqueConditionQuery(
                handler=handler,
                interval=condition.comparison["interval"],
                environment_id=environment_id,
                comparison_interval=condition.comparison.get("comparison_interval"),
            )
        )
    return unique_queries


def get_condition_query_groups(
    data_condition_groups: list[DataConditionGroup],
    dcg_to_groups: DataConditionGroupGroups,
    dcg_to_workflow: dict[int, int],
    workflows_to_envs: WorkflowEnvMapping,
) -> dict[UniqueConditionQuery, set[int]]:
    """
    Map unique condition queries to the group IDs that need to checked for that query.
    """
    condition_groups: dict[UniqueConditionQuery, set[int]] = defaultdict(set)
    for dcg in data_condition_groups:
        slow_conditions = get_slow_conditions(dcg)
        for condition in slow_conditions:
            workflow_id = dcg_to_workflow.get(dcg.id)
            workflow_env = workflows_to_envs[workflow_id] if workflow_id else None
            for condition_query in generate_unique_queries(condition, workflow_env):
                condition_groups[condition_query].update(dcg_to_groups[dcg.id])
    return condition_groups


def get_condition_group_results(
    queries_to_groups: dict[UniqueConditionQuery, set[int]]
) -> dict[UniqueConditionQuery, dict[int, int]]:
    condition_group_results = {}
    current_time = timezone.now()

    for unique_condition, group_ids in queries_to_groups.items():
        handler = unique_condition.handler()

        _, duration = handler.intervals[unique_condition.interval]

        comparison_interval: timedelta | None = None
        if unique_condition.comparison_interval is not None:
            comparison_interval = COMPARISON_INTERVALS_VALUES.get(
                unique_condition.comparison_interval
            )

        result = safe_execute(
            handler.get_rate_bulk,
            duration=duration,
            group_ids=group_ids,
            environment_id=unique_condition.environment_id,
            current_time=current_time,
            comparison_interval=comparison_interval,
        )
        condition_group_results[unique_condition] = result or {}

    return condition_group_results


def get_groups_to_fire(
    data_condition_groups: list[DataConditionGroup],
    workflows_to_envs: WorkflowEnvMapping,
    dcg_to_workflow: dict[int, int],
    dcg_to_groups: DataConditionGroupGroups,
    condition_group_results: dict[UniqueConditionQuery, dict[int, int]],
) -> dict[int, set[DataConditionGroup]]:
    groups_to_fire: dict[int, set[DataConditionGroup]] = defaultdict(set)
    for dcg in data_condition_groups:
        slow_conditions = get_slow_conditions(dcg)
        action_match = DataConditionGroup.Type(dcg.logic_type)
        workflow_id = dcg_to_workflow.get(dcg.id)
        workflow_env = workflows_to_envs[workflow_id] if workflow_id else None

        for group_id in dcg_to_groups[dcg.id]:
            conditions_to_evaluate = []
            for condition in slow_conditions:
                unique_queries = generate_unique_queries(condition, workflow_env)
                query_values = [
                    condition_group_results[unique_query][group_id]
                    for unique_query in unique_queries
                ]
                conditions_to_evaluate.append((condition, query_values))

            passes, _ = evaluate_data_conditions(conditions_to_evaluate, action_match)
            if (
                passes and workflow_id is None
            ):  # TODO: detector trigger passes. do something like create issue
                pass
            elif passes:
                groups_to_fire[group_id].add(dcg)

    return groups_to_fire


def parse_dcg_group_event_data(
    workflow_event_dcg_data: dict[str, str], groups_to_dcgs: dict[int, set[DataConditionGroup]]
) -> tuple[DataConditionGroupEvent, set[str], set[str]]:
    dcg_group_to_event_data: DataConditionGroupEvent = {}  # occurrence_id can be None
    event_ids: set[str] = set()
    occurrence_ids: set[str] = set()

    groups_to_dcg_ids = {
        group_id: {dcg.id for dcg in dcgs} for group_id, dcgs in groups_to_dcgs.items()
    }

    for workflow_group_dcg, instance_data in workflow_event_dcg_data.items():
        data = workflow_group_dcg.split(":")
        event_data = json.loads(instance_data)

        event_id = event_data.get("event_id")
        if event_id:
            event_ids.add(event_id)

        occurrence_id = event_data.get("occurrence_id")
        if occurrence_id:
            occurrence_ids.add(occurrence_id)

        group_id = int(data[1])
        dcg_ids = [int(dcg_id) for dcg_id in data[2].split(",")]

        for dcg_id in dcg_ids:
            if dcg_id in groups_to_dcg_ids[group_id]:
                dcg_group_to_event_data[(int(dcg_id), int(group_id))] = event_data

    return dcg_group_to_event_data, event_ids, occurrence_ids


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


def get_group_to_groupevent(
    dcg_group_to_event_data: DataConditionGroupEvent,
    group_ids: list[int],
    event_ids: set[str],
    occurrence_ids: set[str],
    project_id: int,
) -> dict[Group, GroupEvent]:
    groups = Group.objects.filter(id__in=group_ids)
    group_id_to_group = {group.id: group for group in groups}

    bulk_event_id_to_events = bulk_fetch_events(list(event_ids), project_id)
    bulk_occurrences = IssueOccurrence.fetch_multi(list(occurrence_ids), project_id=project_id)

    bulk_occurrence_id_to_occurrence = {
        occurrence.id: occurrence for occurrence in bulk_occurrences if occurrence
    }

    group_to_groupevent: dict[Group, GroupEvent] = {}
    for dcg_group, instance_data in dcg_group_to_event_data.items():
        event_id = instance_data.get("event_id")
        occurrence_id = instance_data.get("occurrence_id")

        if event_id is None:
            continue

        event = bulk_event_id_to_events.get(event_id)
        group = group_id_to_group.get(int(dcg_group[1]))

        if not group or not event:
            continue

        group_event = event.for_group(group)
        if occurrence_id:
            group_event.occurrence = bulk_occurrence_id_to_occurrence.get(occurrence_id)
        group_to_groupevent[group] = group_event

    return group_to_groupevent


def fire_actions_for_groups(
    groups_to_fire: dict[int, set[DataConditionGroup]],
    trigger_type_to_dcg_model: dict[DataConditionHandlerType, dict[int, int]],
    group_to_groupevent: dict[Group, GroupEvent],
) -> None:
    for group, group_event in group_to_groupevent.items():
        job = WorkflowJob({"event": group_event})
        detector = get_detector_by_event(job)

        workflow_triggers: set[DataConditionGroup] = set()
        action_filters: set[DataConditionGroup] = set()
        for dcg in groups_to_fire[group.id]:
            if dcg.id in trigger_type_to_dcg_model[DataConditionHandlerType.WORKFLOW_TRIGGER]:
                workflow_triggers.add(dcg)
            elif dcg.id in trigger_type_to_dcg_model[DataConditionHandlerType.ACTION_FILTER]:
                action_filters.add(dcg)

        # process action filters
        filtered_actions: list[Action] = list(
            filter_recently_fired_workflow_actions(action_filters, group)
        )

        # process workflow_triggers
        workflows = set(Workflow.objects.filter(when_condition_group_id__in=workflow_triggers))
        filtered_actions.extend(list(evaluate_workflows_action_filters(workflows, job)))

        for action in filtered_actions:
            action.trigger(job, detector)


@instrumented_task(
    name="sentry.workflow_engine.processors.delayed_workflow",
    queue="delayed_rules",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
)
def process_delayed_workflows(
    project_id: int, batch_key: str | None = None, *args: Any, **kwargs: Any
) -> None:
    """
    Grab workflows, groups, and data condition groups from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    project = fetch_project(project_id)
    if not project:
        return

    workflow_event_dcg_data = fetch_group_to_event_data(project_id, Workflow, batch_key)

    # Get mappings from DataConditionGroups to other info
    dcg_to_groups, trigger_type_to_dcg_model = get_dcg_group_workflow_detector_data(
        workflow_event_dcg_data
    )
    dcg_to_workflow = trigger_type_to_dcg_model[DataConditionHandlerType.WORKFLOW_TRIGGER].copy()
    dcg_to_workflow.update(trigger_type_to_dcg_model[DataConditionHandlerType.ACTION_FILTER])

    _, workflows_to_envs = fetch_workflows_envs(list(dcg_to_workflow.values()))
    data_condition_groups = fetch_data_condition_groups(list(dcg_to_groups.keys()))

    # Get unique query groups to query Snuba
    condition_groups = get_condition_query_groups(
        data_condition_groups, dcg_to_groups, dcg_to_workflow, workflows_to_envs
    )
    condition_group_results = get_condition_group_results(condition_groups)

    # Evaluate DCGs
    groups_to_dcgs = get_groups_to_fire(
        data_condition_groups,
        workflows_to_envs,
        dcg_to_workflow,
        dcg_to_groups,
        condition_group_results,
    )

    dcg_group_to_event_data, event_ids, occurrence_ids = parse_dcg_group_event_data(
        workflow_event_dcg_data, groups_to_dcgs
    )
    group_to_groupevent = get_group_to_groupevent(
        dcg_group_to_event_data, list(groups_to_dcgs.keys()), event_ids, occurrence_ids, project_id
    )

    fire_actions_for_groups(groups_to_dcgs, trigger_type_to_dcg_model, group_to_groupevent)

    # TODO(cathy): clean up redis buffer


# TODO: add to registry

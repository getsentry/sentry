import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry import buffer
from sentry.db import models
from sentry.models.project import Project
from sentry.rules.conditions.event_frequency import COMPARISON_INTERVALS
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.registry import NoRegistrationExistsError
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.handlers.condition.slow_condition_query_handlers import (
    BaseEventFrequencyQueryHandler,
    slow_condition_query_handler_registry,
)
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, Workflow
from sentry.workflow_engine.models.data_condition import (
    PERCENT_CONDITIONS,
    SLOW_CONDITIONS,
    Condition,
)
from sentry.workflow_engine.models.data_condition_group import get_slow_conditions
from sentry.workflow_engine.processors.data_condition_group import evaluate_data_conditions
from sentry.workflow_engine.types import DataConditionHandlerType

logger = logging.getLogger("sentry.workflow_engine.processors.delayed_workflow")

COMPARISON_INTERVALS_VALUES = {k: v[1] for k, v in COMPARISON_INTERVALS.items()}

DataConditionGroupGroups = dict[int, set[int]]
WorkflowMapping = dict[int, Workflow]
WorkflowEnvMapping = dict[int, int | None]


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
    Parse the data in the buffer hash, which is in the form of {workflow/detector_id}:{event_id}:{dcg_id, ..., dcg_id}:{dcg_type}
    """

    dcg_to_groups: DataConditionGroupGroups = defaultdict(set)
    trigger_type_to_dcg_model: dict[DataConditionHandlerType, dict[int, int]] = defaultdict(dict)

    for workflow_event_dcg, _ in workflow_event_dcg_data.items():
        data = workflow_event_dcg.split(":")
        try:
            dcg_type = DataConditionHandlerType(data[3])
        except ValueError:
            continue

        event_id = int(data[1])
        dcg_ids = [int(dcg_id) for dcg_id in data[2].split(",")]

        for dcg_id in dcg_ids:
            dcg_to_groups[dcg_id].add(event_id)

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
    _ = get_groups_to_fire(
        data_condition_groups,
        workflows_to_envs,
        dcg_to_workflow,
        dcg_to_groups,
        condition_group_results,
    )

    # TODO(cathy): fire actions on passing groups
    # TODO(cathy): clean up redis buffer


# TODO: add to registry

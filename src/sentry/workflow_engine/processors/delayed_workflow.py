import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, DefaultDict, NamedTuple

import sentry_sdk
from celery import Task

from sentry import buffer
from sentry.db import models
from sentry.models.project import Project
from sentry.rules.conditions.event_frequency import DEFAULT_COMPARISON_INTERVAL
from sentry.rules.processing.buffer_processing import (
    COMPARISON_INTERVALS_VALUES,
    BufferHashKeys,
    DelayedProcessingBase,
    FilterKeys,
    delayed_processing_registry,
    fetch_alertgroup_to_event_data,
)
from sentry.rules.processing.delayed_processing import get_group_to_groupevent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.registry import NoRegistrationExistsError
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.handlers.condition.event_frequency_base_handler import (
    BaseEventFrequencyConditionHandler,
)
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import (
    PERCENT_CONDITIONS,
    SLOW_CONDITIONS,
    Condition,
    condition_handler_registry,
)
from sentry.workflow_engine.models.data_condition_group import get_slow_conditions
from sentry.workflow_engine.processors.action import (
    evaluate_workflow_action_filters,
    get_filtered_actions,
)
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.processors.workflow import WORKFLOW_ENGINE_BUFFER_LIST_KEY
from sentry.workflow_engine.types import WorkflowJob

logger = logging.getLogger("sentry.rules.delayed_processing")


class UniqueConditionQuery(NamedTuple):
    """
    Represents all the data that uniquely identifies a condition class and its
    single respective Snuba query that must be made. Multiple instances of the
    same condition class can share the single query.
    """

    handler: type[BaseEventFrequencyConditionHandler]
    interval: str
    environment_id: int
    comparison_interval: str | None = None

    def __repr__(self):
        return (
            f"<UniqueConditionQuery:\nid: {self.cls_id},\ninterval: {self.interval},\nenv id: {self.environment_id},\n"
            f"comp interval: {self.comparison_interval}\n>"
        )


def fetch_project(project_id: int) -> Project | None:
    try:
        return Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.info(
            "delayed_processing.project_does_not_exist",
            extra={"project_id": project_id},
        )
        return None


def get_dcg_group_workflow_data(
    worklow_event_dcg_data: dict[str, str]
) -> tuple[DefaultDict[int, set[int]], dict[int, int]]:
    dcg_to_groups: DefaultDict[int, set[int]] = defaultdict(set)
    dcg_to_workflow: dict[int, int] = {}
    dcg_group_to_event_data = dict[tuple[int, int], dict[str, str]]

    for workflow_event_dcg, instance_data in worklow_event_dcg_data.items():
        data = workflow_event_dcg.split(":")
        workflow_id = int(data[0])
        event_id = int(data[1])
        dcg_ids = [int(dcg_id) for dcg_id in data[2].split(",")]
        event_data = json.loads(instance_data)
        for dcg_id in dcg_ids:
            dcg_to_groups[dcg_id].add(event_id)
            dcg_to_workflow[dcg_id] = workflow_id
            dcg_group_to_event_data[(workflow_id, dcg_id)] = event_data
    return dcg_to_groups, dcg_to_workflow, dcg_group_to_event_data


def fetch_data_condition_groups(dcg_ids: list[int]) -> list[DataConditionGroup]:
    # TODO: filter out DCGs with disabled workflows
    return list(DataConditionGroup.objects.filter(id__in=dcg_ids))


def fetch_workflows_to_environments(workflow_ids: list[int]) -> dict[int, int]:
    workflow_to_env: dict[int, int] = {}
    workflows = list(Workflow.objects.filter(id__in=workflow_ids))
    for workflow in workflows:
        workflow_to_env[workflow.id] = workflow.environment.id

    return workflow_to_env


def generate_unique_queries(
    condition: DataCondition, environment_id: int
) -> list[UniqueConditionQuery]:
    """
    Returns a list of all unique condition queries that must be made for the
    given condition instance.
    Count comparison conditions will only have one unique query, while percent
    comparison conditions will have two unique queries.
    """

    condition_type = Condition(condition.type)
    if condition_type not in SLOW_CONDITIONS:
        # not sure how we get to delayed processing without a slow condition...
        return []

    try:
        handler = condition_handler_registry.get(condition_type)
    except NoRegistrationExistsError:
        logger.exception(
            "No registration exists for condition",
            extra={"type": condition.type, "id": condition.id},
        )
        return []

    if not isinstance(handler, BaseEventFrequencyConditionHandler):
        return []

    unique_queries = [
        UniqueConditionQuery(
            handler=handler.base_handler,
            interval=condition.comparison["interval"],
            environment_id=environment_id,
        )
    ]
    if condition.type in PERCENT_CONDITIONS:
        unique_queries.append(
            UniqueConditionQuery(
                handler=handler.base_handler,
                interval=condition.comparison["interval"],
                environment_id=environment_id,
                comparison_interval=condition.comparison.get(
                    "comparison_interval", DEFAULT_COMPARISON_INTERVAL
                ),
            )
        )
    return unique_queries


def get_condition_query_groups(
    data_condition_groups: list[DataConditionGroup],
    dcg_to_groups: DefaultDict[int, set[int]],
    dcg_to_workflow: dict[int, int],
    workflows_to_envs: dict[int, int],
) -> dict[UniqueConditionQuery, set[int]]:
    """
    Map unique condition queries to the group IDs that need to checked for that
    query. We also store a pointer to that condition's JSON so we can
    instantiate the class later.
    """
    condition_groups: dict[UniqueConditionQuery, set[int]] = defaultdict(set)
    for dcg in data_condition_groups:
        slow_conditions = get_slow_conditions(dcg)
        for condition in slow_conditions:
            for condition_query in generate_unique_queries(
                condition, workflows_to_envs[dcg_to_workflow[dcg.id]]
            ):
                # NOTE: If percent and count comparison conditions are sharing
                # the same UniqueConditionQuery, the condition JSON in
                # DataAndGroups will be incorrect for one of those types.
                # The JSON will either have or be missing a comparisonInterval
                # which only applies to percent conditions, and have the incorrect
                # comparisonType for one type. This is not a concern because
                # when we instantiate the exact condition class with the JSON,
                # the class ignores both fields when calling get_rate_bulk.

                # Add to set of group_ids if there are already group_ids
                # that apply to the unique condition query.
                condition_groups[condition_query].update(dcg_to_groups[dcg.id])
    return condition_groups


def get_condition_group_results(
    queries_to_groups: dict[UniqueConditionQuery, set[int]]
) -> dict[UniqueConditionQuery, dict[int, int]] | None:
    condition_group_results = {}
    current_time = datetime.now(tz=timezone.utc)

    for unique_condition, group_ids in queries_to_groups.items():
        handler = unique_condition.handler

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
    workflows_to_envs: dict[int, int],
    dcg_to_workflow: dict[int, int],
    dcg_to_groups: dict[int, set[int]],
    condition_group_results: dict[UniqueConditionQuery, dict[int, int]],
) -> DefaultDict[int, set[DataConditionGroup]]:
    groups_to_fire: DefaultDict[int, set[DataConditionGroup]] = defaultdict(set)
    for dcg in data_condition_groups:
        slow_conditions = get_slow_conditions(dcg)
        conditions_matched = 0
        action_match = dcg.logic_type
        for group_id in dcg_to_groups[dcg.id]:
            for condition in slow_conditions:
                unique_queries = generate_unique_queries(
                    condition, workflows_to_envs[dcg_to_workflow[dcg.id]]
                )
                query_values = [
                    condition_group_results[unique_query][group_id]
                    for unique_query in unique_queries
                ]

                try:
                    handler = condition_handler_registry.get(condition.type)
                except NoRegistrationExistsError:
                    logger.exception(
                        "No registration exists for condition",
                        extra={"type": condition.type, "id": condition.id},
                    )
                    continue

                if not handler.evaluate_value(query_values):
                    continue

                if action_match == "any":
                    groups_to_fire[group_id].add(dcg)
                    break
                elif action_match == "all":
                    conditions_matched += 1

            if action_match == "all" and conditions_matched == len(slow_conditions):
                groups_to_fire[group_id].add(dcg)
    return groups_to_fire


def split_dcgs(
    data_condition_groups: list[DataConditionGroup], dcg_to_workflow: dict[int, int]
) -> tuple[set[DataConditionGroup], set[DataConditionGroup]]:
    WHEN_dcgs = set()
    IF_dcgs = set()
    for dcg in data_condition_groups:
        workflow_id = dcg_to_workflow[dcg.id]
        if WorkflowDataConditionGroup.objects.filter(
            workflow_id=workflow_id, data_condition_group=dcg
        ).exists():
            IF_dcgs.add(dcg)
        else:
            WHEN_dcgs.add(dcg)
    return WHEN_dcgs, IF_dcgs


def fire_dcgs(
    groups_to_fire: DefaultDict[int, set[DataConditionGroup]],
    dcg_to_workflow: dict[int, int],
    dcg_group_to_event_data: dict[tuple[int, int], dict[str, str]],
    project: Project,
) -> None:
    dcg_sets = groups_to_fire.values()
    dcgs = set()
    for dcg_set in dcg_sets:
        dcgs.update(dcg_set)

    WHEN_dcgs, IF_dcgs = split_dcgs(dcgs, dcg_to_workflow)

    group_to_groupevent = get_group_to_groupevent(
        dcg_group_to_event_data, project.id, groups_to_fire.keys()
    )
    for group, group_event in group_to_groupevent.items():
        job = WorkflowJob({"event": group_event})
        detector = get_detector_by_event(job)

        dcgs_to_fire = groups_to_fire[group.id]
        group_WHEN_dcgs = WHEN_dcgs.intersection(dcgs_to_fire)
        group_IF_dcgs = IF_dcgs.intersection(dcgs_to_fire)

        filtered_actions: list[Action] = []
        workflows = Workflow.objects.filter(when_condition_group__in=group_WHEN_dcgs)

        filtered_actions.extend(list(evaluate_workflow_action_filters(workflows, job)))
        filtered_actions.extend(list(get_filtered_actions(group_IF_dcgs, job)))

        with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
            for action in filtered_actions:
                action.trigger(job, detector)


def cleanup_redis_buffer(
    project_id: int, workflow_event_dcg_data: dict[str, str], batch_key: str | None
) -> None:
    hashes_to_delete = list(workflow_event_dcg_data.keys())
    filters: dict[str, models.Model | str | int] = {"project_id": project_id}
    if batch_key:
        filters["batch_key"] = batch_key

    buffer.backend.delete_hash(model=Workflow, filters=filters, fields=hashes_to_delete)


@instrumented_task(
    name="sentry.rules.processing.delayed_processing",
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
    Grab workflows, groups, and events from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    project = fetch_project(project_id)
    if not project:
        return

    workflow_event_dcg_data = fetch_alertgroup_to_event_data(project_id, Workflow, batch_key)
    dcg_to_groups, dcg_to_workflow, dcg_group_to_event_data = get_dcg_group_workflow_data(
        workflow_event_dcg_data
    )
    data_condition_groups = fetch_data_condition_groups(list(dcg_to_groups.keys()))
    workflows_to_envs = fetch_workflows_to_environments(list(dcg_to_workflow.values()))

    condition_groups = get_condition_query_groups(
        data_condition_groups, dcg_to_groups, dcg_to_workflow, workflows_to_envs
    )
    # logger.info(
    #     "delayed_processing.condition_groups",
    #     extra={"condition_groups": condition_groups, "project_id": project_id},
    # )

    # with metrics.timer("delayed_processing.get_condition_group_results.duration"):
    condition_group_results = get_condition_group_results(condition_groups)

    groups_to_fire = get_groups_to_fire(
        data_condition_groups,
        workflows_to_envs,
        dcg_to_workflow,
        dcg_to_groups,
        condition_group_results,
    )

    with metrics.timer("delayed_processing.fire_rules.duration"):
        fire_dcgs(groups_to_fire, dcg_to_workflow, dcg_group_to_event_data, project)

    cleanup_redis_buffer(project_id, workflow_event_dcg_data, batch_key)


@delayed_processing_registry.register("delayed_workflows")  # default delayed processing
class DelayedRule(DelayedProcessingBase):
    buffer_key = WORKFLOW_ENGINE_BUFFER_LIST_KEY

    @property
    def hash_args(self) -> BufferHashKeys:
        return BufferHashKeys(model=Workflow, filters=FilterKeys(project_id=self.project_id))

    @property
    def processing_task(self) -> Task:
        return process_delayed_workflows

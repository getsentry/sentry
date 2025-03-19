import logging
from enum import StrEnum

import sentry_sdk
from django.db import router, transaction
from django.db.models import Q

from sentry import buffer, features
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.eventstore.models import GroupEvent
from sentry.utils import json, metrics
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.processors.action import filter_recently_fired_workflow_actions
from sentry.workflow_engine.processors.data_condition_group import process_data_condition_group
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.types import WorkflowJob

logger = logging.getLogger(__name__)

WORKFLOW_ENGINE_BUFFER_LIST_KEY = "workflow_engine_delayed_processing_buffer"


class WorkflowDataConditionGroupType(StrEnum):
    ACTION_FILTER = "action_filter"
    WORKFLOW_TRIGGER = "workflow_trigger"


def enqueue_workflow(
    workflow: Workflow,
    delayed_conditions: list[DataCondition],
    event: GroupEvent,
    source: WorkflowDataConditionGroupType,
) -> None:
    project_id = event.group.project.id

    buffer.backend.push_to_sorted_set(key=WORKFLOW_ENGINE_BUFFER_LIST_KEY, value=project_id)

    condition_group_set = {condition.condition_group_id for condition in delayed_conditions}
    condition_groups = ",".join(
        str(condition_group_id) for condition_group_id in condition_group_set
    )

    value = json.dumps({"event_id": event.event_id, "occurrence_id": event.occurrence_id})
    buffer.backend.push_to_hash(
        model=Workflow,
        filters={"project_id": project_id},
        field=f"{workflow.id}:{event.group.id}:{condition_groups}:{source}",
        value=value,
    )


def evaluate_workflow_triggers(workflows: set[Workflow], job: WorkflowJob) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()

    for workflow in workflows:
        evaluation, remaining_conditions = workflow.evaluate_trigger_conditions(job)

        if remaining_conditions:
            enqueue_workflow(
                workflow,
                remaining_conditions,
                job["event"],
                WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
            )
        else:
            if evaluation:
                triggered_workflows.add(workflow)

    return triggered_workflows


def evaluate_workflows_action_filters(
    workflows: set[Workflow],
    job: WorkflowJob,
) -> BaseQuerySet[Action]:
    filtered_action_groups: set[DataConditionGroup] = set()

    # Gets the list of the workflow ids, and then get the workflow_data_condition_groups for those workflows
    workflow_ids_to_envs = {workflow.id: workflow.environment for workflow in workflows}

    action_conditions = DataConditionGroup.objects.filter(
        workflowdataconditiongroup__workflow_id__in=list(workflow_ids_to_envs.keys())
    ).distinct()

    workflow_to_dcg = dict(
        WorkflowDataConditionGroup.objects.filter(
            condition_group_id__in=action_conditions
        ).values_list("condition_group_id", "workflow")
    )

    for action_condition in action_conditions:
        # Populate the workflow environment in the job for the action_condition evaluation
        workflow_id = workflow_to_dcg.get(action_condition.id)
        if workflow_id:
            job["workflow_env"] = workflow_ids_to_envs[workflow_id]

        (evaluation, result), remaining_conditions = process_data_condition_group(
            action_condition.id, job
        )

        if remaining_conditions:
            # If there are remaining conditions for the action filter to evaluate,
            # then return the list of conditions to enqueue
            condition_group = action_condition.workflowdataconditiongroup_set.first()
            if condition_group:
                enqueue_workflow(
                    condition_group.workflow,
                    remaining_conditions,
                    job["event"],
                    WorkflowDataConditionGroupType.ACTION_FILTER,
                )
        else:
            if evaluation:
                filtered_action_groups.add(action_condition)

    return filter_recently_fired_workflow_actions(filtered_action_groups, job["event"].group)


def log_fired_workflows(log_name: str, actions: list[Action], job: WorkflowJob) -> None:
    # go from actions to workflows
    action_ids = {action.id for action in actions}
    action_conditions = DataConditionGroup.objects.filter(
        dataconditiongroupaction__action_id__in=action_ids
    ).values_list("id", flat=True)
    workflows_to_fire = Workflow.objects.filter(
        workflowdataconditiongroup__condition_group_id__in=action_conditions
    )
    workflow_to_rule = dict(
        AlertRuleWorkflow.objects.filter(workflow__in=workflows_to_fire).values_list(
            "workflow_id", "rule_id"
        )
    )

    for workflow in workflows_to_fire:
        logger.info(
            log_name,
            extra={
                "workflow_id": workflow.id,
                "rule_id": workflow_to_rule.get(workflow.id),
                "payload": job,
                "group_id": job["event"].group_id,
                "event_id": job["event"].event_id,
            },
        )


def process_workflows(job: WorkflowJob) -> set[Workflow]:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    # Check to see if the GroupEvent has an issue occurrence
    try:
        detector = get_detector_by_event(job)
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.process_workflows.error")
        logger.exception("Detector not found for event", extra={"event_id": job["event"].event_id})
        return set()

    # TODO: remove fetching org, only used for FF check
    organization = detector.project.organization

    # Get the workflows, evaluate the when_condition_group, finally evaluate the actions for workflows that are triggered
    workflows = set(
        Workflow.objects.filter(
            (Q(environment_id=None) | Q(environment_id=job["event"].get_environment())),
            detectorworkflow__detector_id=detector.id,
            enabled=True,
        ).distinct()
    )

    if workflows:
        metrics.incr(
            "workflow_engine.process_workflows",
            len(workflows),
            tags={"detector_type": detector.type},
        )

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.evaluate_workflow_triggers"):
        triggered_workflows = evaluate_workflow_triggers(workflows, job)

        if triggered_workflows:
            metrics.incr(
                "workflow_engine.process_workflows.triggered_workflows",
                len(triggered_workflows),
                tags={"detector_type": detector.type},
            )

    with sentry_sdk.start_span(
        op="workflow_engine.process_workflows.evaluate_workflows_action_filters"
    ):
        actions = evaluate_workflows_action_filters(triggered_workflows, job)

        if features.has(
            "organizations:workflow-engine-process-workflows",
            organization,
        ):
            metrics.incr(
                "workflow_engine.process_workflows.triggered_actions",
                amount=len(actions),
                tags={"detector_type": detector.type},
            )

        if features.has(
            "organizations:workflow-engine-process-workflows-logs",
            organization,
        ):
            log_fired_workflows(
                log_name="workflow_engine.process_workflows.fired_workflow",
                actions=list(actions),
                job=job,
            )

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        if features.has(
            "organizations:workflow-engine-trigger-actions",
            organization,
        ):
            # TODO: attach correct env to job. consider refactoring
            for action in actions:
                action.trigger(job, detector)

    return triggered_workflows


def delete_workflow(workflow: Workflow) -> bool:
    with transaction.atomic(router.db_for_write(Workflow)):
        action_filters = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )

        actions = Action.objects.filter(
            dataconditiongroupaction__condition_group__in=action_filters
        )

        # Delete the actions associated with a workflow, this is not a cascade delete
        # because we want to create a UI to maintain notification actions separately
        if actions:
            actions.delete()

        if action_filters:
            action_filters.delete()

        if workflow.when_condition_group:
            workflow.when_condition_group.delete()

        workflow.delete()

    return True

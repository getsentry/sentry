from __future__ import annotations

import logging

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Detector,
    WorkflowDataConditionGroup,
    WorkflowFireHistory,
)
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)

EnqueuedAction = tuple[DataConditionGroup, list[DataCondition]]


def create_workflow_fire_histories(
    detector: Detector, actions_to_fire: BaseQuerySet[Action], event_data: WorkflowEventData
) -> list[WorkflowFireHistory]:
    """
    Record that the workflows associated with these actions were fired for this
    event.
    """
    # Create WorkflowFireHistory objects for workflows we fire actions for
    workflow_ids = set(
        WorkflowDataConditionGroup.objects.filter(
            condition_group__dataconditiongroupaction__action__in=actions_to_fire
        ).values_list("workflow_id", flat=True)
    )

    event_id = (
        event_data.event.event_id
        if isinstance(event_data.event, GroupEvent)
        else event_data.event.id
    )

    fire_histories = [
        WorkflowFireHistory(
            detector_id=detector.id,
            workflow_id=workflow_id,
            group=event_data.group,
            event_id=event_id,
        )
        for workflow_id in workflow_ids
    ]
    return WorkflowFireHistory.objects.bulk_create(fire_histories)

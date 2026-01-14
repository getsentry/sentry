from __future__ import annotations

import logging
from datetime import datetime, timezone

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    WorkflowDataConditionGroup,
    WorkflowFireHistory,
)
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import scopedstats

logger = logging.getLogger(__name__)

EnqueuedAction = tuple[DataConditionGroup, list[DataCondition]]


@scopedstats.timer()
def create_workflow_fire_histories(
    actions_to_fire: BaseQuerySet[Action],
    event_data: WorkflowEventData,
    is_delayed: bool = False,
    start_timestamp: datetime | None = None,
) -> list[WorkflowFireHistory]:
    """
    Record that the workflows associated with these actions were fired for this
    event.

    If we're reporting a fire due to delayed processing, is_delayed should be True.
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

    if start_timestamp:
        fire_latency_seconds = (datetime.now(timezone.utc) - start_timestamp).total_seconds()
        group_type = event_data.group.issue_type.slug

        for _ in workflow_ids:
            metrics.timing(
                "workflow_fire_history.latency",
                fire_latency_seconds,
                tags={"delayed": is_delayed, "group_type": group_type},
            )

    fire_histories = [
        WorkflowFireHistory(
            workflow_id=workflow_id,
            group=event_data.group,
            event_id=event_id,
        )
        for workflow_id in workflow_ids
    ]
    return WorkflowFireHistory.objects.bulk_create(fire_histories)

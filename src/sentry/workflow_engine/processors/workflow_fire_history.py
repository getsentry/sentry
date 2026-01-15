from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timezone

from django.db.models import OuterRef, Subquery

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Workflow,
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
    is_single_processing: bool,
    is_delayed: bool = False,
    start_timestamp: datetime | None = None,
) -> list[WorkflowFireHistory]:
    """
    Record that the workflows associated with these actions were fired for this
    event.

    If we're reporting a fire due to delayed processing, is_delayed should be True.
    """
    # Only write canonical fire history records
    if not is_single_processing:
        return []
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


def get_last_fired_dates(workflow_ids: Sequence[int]) -> dict[int, datetime | None]:
    """
    Efficiently retrieves the last fire date for each workflow id.

    Returns a dict mapping workflow_id to last fire date. If a workflow has never
    fired, its value will be None. If a workflow_id doesn't exist, it will not
    appear in the returned dict.
    """
    if not workflow_ids:
        return {}

    # Uses a correlated subquery with LIMIT 1 to leverage the (workflow, date_added)
    # index, avoiding a full index scan that MAX() + GROUP BY would require.
    latest_fire_subquery = (
        WorkflowFireHistory.objects.filter(workflow_id=OuterRef("id"))
        .order_by("-date_added")
        .values("date_added")[:1]
    )

    results = (
        Workflow.objects.filter(id__in=workflow_ids)
        .annotate(last_fire=Subquery(latest_fire_subquery))
        .values_list("id", "last_fire")
    )
    return {wf_id: last_fire for wf_id, last_fire in results}

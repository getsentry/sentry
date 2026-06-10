from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.workflow_engine.registry import workflow_activity_registry
from sentry.workflow_engine.types import DetectorId

if TYPE_CHECKING:
    from sentry.models.activity import Activity
    from sentry.models.group import Group

logger = logging.getLogger(__name__)

DURATION_METRIC = "workflow_engine.invoke_workflow_activity_handlers.duration"


def invoke_workflow_activity_handlers(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    """
    Call each workflow activity handler in a consistent way. This allows us to have
    shared metrics for each activity, and each handler. Showing us the timing metrics
    for how long each handler took, for a given activity.

    This also means that if there's a new handler registered, it will automatically
    have metrics and timing support out of the box.
    """
    try:
        activity_type = ActivityType(activity.type)
    except ValueError:
        logger.exception(
            "workflow_engine.seer_activity_handler.invalid_activity_type",
            extra={"activity_type": activity.type},
        )
        return

    for handler_key, handler in workflow_activity_registry.registrations.items():
        try:
            with metrics.timer(
                DURATION_METRIC,
                tags={"handler": handler_key, "activity_type": activity_type},
            ):
                handler(group, activity, detector_id)

        except Exception:
            logger.exception(
                "workflow_engine.invoke_workflow_activity_handlers.error",
                extra={
                    "group_id": group.id,
                    "activity_id": activity.id,
                    "handler_name": handler_key,
                    "activity_type": activity_type,
                },
            )

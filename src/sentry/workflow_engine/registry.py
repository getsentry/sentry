import logging
from typing import Any

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    DetectorId,
    WorkflowActivityHandler,
)

logger = logging.getLogger(__name__)

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)


def invoke_workflow_activity_handlers(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    for handler_key, handler in workflow_activity_registry.registrations.items():
        try:
            handler(group, activity, detector_id)
        except Exception:
            logger.exception(
                "workflow_engine.invoke_workflow_activity_handlers.error",
                extra={
                    "group_id": group.id,
                    "activity_id": activity.id,
                    "handler_name": handler_key,
                    "activity_type": activity.type,
                },
            )
            continue

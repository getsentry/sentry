from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    DetectorSettings,
    DetectorSettingsRegistry,
    WorkflowActivityHandler,
)

if TYPE_CHECKING:
    from sentry.issues.grouptype import GroupType

logger = logging.getLogger(__name__)

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)

detector_settings_registry = DetectorSettingsRegistry()


def get_detector_settings(group_type: type[GroupType]) -> DetectorSettings | None:
    """
    Look up DetectorSettings for a GroupType via its detector_type and the
    DetectorSettingsRegistry. Use this instead of depending directly on
    DetectorSettings from GroupType code.
    """
    if group_type.detector_type is None:
        return None
    settings = detector_settings_registry.get(group_type.detector_type)
    if settings is None:
        raise ValueError(
            f"DetectorType {group_type.detector_type!r} on {group_type.__name__} "
            f"has no registered DetectorSettings. This usually means the module "
            f"that registers settings for this DetectorType was not imported."
        )
    return settings


def invoke_workflow_activity_handlers(group: Group, activity: Activity) -> None:
    for handler_key, handler in workflow_activity_registry.registrations.items():
        try:
            handler(group, activity)
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

from typing import Any

from django.db.models import Q

from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    DetectorSettings,
    WorkflowActivityHandler,
)

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)
detector_settings_registry = Registry[type[DetectorSettings]](enable_reverse_lookup=False)


def get_detector_type_filters() -> Q:
    """Apply registered filters and include detector types without a filter."""
    types_with_filters = []
    filtered_type_conditions = Q()

    for detector_type, settings in detector_settings_registry.registrations.items():
        if settings.filter is not None:
            types_with_filters.append(detector_type)
            filtered_type_conditions |= Q(type=detector_type) & settings.filter

    return ~Q(type__in=types_with_filters) | filtered_type_conditions

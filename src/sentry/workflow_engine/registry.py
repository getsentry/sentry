from collections.abc import Callable
from typing import Any

from django.db.models import Q

from sentry.utils.registry import Registry
from sentry.workflow_engine.types import (
    ActionHandler,
    DataConditionHandler,
    DataSourceTypeHandler,
    DetectorSettings,
    DetectorType,
    WorkflowActivityHandler,
)

data_source_type_registry = Registry[type[DataSourceTypeHandler[Any]]]()
condition_handler_registry = Registry[type[DataConditionHandler[Any]]](enable_reverse_lookup=False)
action_handler_registry = Registry[type[ActionHandler]](enable_reverse_lookup=False)
workflow_activity_registry = Registry[WorkflowActivityHandler](enable_reverse_lookup=False)


class DetectorSettingsRegistry(Registry[type[DetectorSettings]]):
    def register(self, key: str) -> Callable[[type[DetectorSettings]], type[DetectorSettings]]:
        if not isinstance(key, DetectorType):
            raise ValueError("Detector settings must be registered with a DetectorType member")
        return super().register(key)


detector_settings_registry = DetectorSettingsRegistry(enable_reverse_lookup=False)


def get_detector_type_filters() -> Q:
    """
    Build a Q object that combines all detector type-specific filters.

    For detector types without filters, they're included by default via a NOT IN clause.
    For detector types with filters, we apply the specific filter condition.

    This optimizes the query since most detector types won't have filters.
    """
    types_with_filters = []
    filtered_type_conditions = Q()

    for detector_type, settings in detector_settings_registry.registrations.items():
        if settings.filter is not None:
            types_with_filters.append(detector_type)
            filtered_type_conditions |= Q(type=detector_type) & settings.filter

    # Include all types that don't have filters (type NOT IN types_with_filters)
    # OR match the specific filter conditions for types that do have filters.
    return ~Q(type__in=types_with_filters) | filtered_type_conditions

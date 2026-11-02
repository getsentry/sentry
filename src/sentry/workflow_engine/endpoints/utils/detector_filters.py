from django.db.models import Q

from sentry.workflow_engine.registry import detector_settings_registry


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

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import Q

from sentry.workflow_engine.endpoints.utils.api_availability import (
    get_excluded_types,
    is_api_operation_available,
)
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import WorkflowEngineAPIOperation

if TYPE_CHECKING:
    from sentry.auth.principal import RequestPrincipal
    from sentry.models.organization import Organization


def get_visible_detector_types(organization: Organization) -> list[str]:
    """Types advertised in discovery and validation suggestions, before eligibility checks."""
    return [
        detector_type
        for detector_type, settings in detector_settings_registry.registrations.items()
        if is_api_operation_available(settings, WorkflowEngineAPIOperation.DISCOVER, organization)
    ]


def get_excluded_detector_types(
    operation: WorkflowEngineAPIOperation | str | None,
    organization: Organization,
    *,
    actor: RequestPrincipal | None = None,
) -> list[str]:
    """Resolve detector-platform API gates for the current request, without fetching rows."""
    return get_excluded_types(
        detector_settings_registry.registrations, operation, organization, actor=actor
    )


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

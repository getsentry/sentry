from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING

from sentry import features
from sentry.workflow_engine.types import BaseWorkflowEngineSettings, WorkflowEngineAPIOperation

if TYPE_CHECKING:
    from sentry.auth.principal import RequestPrincipal
    from sentry.models.organization import Organization


_API_OPERATIONS_BY_NAME: dict[str | None, WorkflowEngineAPIOperation] = {
    operation.value: operation for operation in WorkflowEngineAPIOperation
}

_API_OPERATIONS_BY_NAME["HEAD"] = WorkflowEngineAPIOperation.GET


def is_api_operation_available(
    settings: type[BaseWorkflowEngineSettings],
    operation: WorkflowEngineAPIOperation,
    organization: Organization,
    *,
    actor: RequestPrincipal | None = None,
) -> bool:
    gate = settings.api_availability.get(
        operation, BaseWorkflowEngineSettings.DEFAULT_API_AVAILABILITY[operation]
    )

    if isinstance(gate, bool):
        return gate

    # Type discovery uses organization visibility; row operations also use the actor.
    if operation == WorkflowEngineAPIOperation.DISCOVER:
        actor = None

    return features.has(gate.name, organization, actor=actor)


def get_excluded_types(
    settings_by_type: Mapping[str, type[BaseWorkflowEngineSettings]],
    operation: WorkflowEngineAPIOperation | str | None,
    organization: Organization,
    *,
    actor: RequestPrincipal | None = None,
) -> list[str]:
    """Resolve API gates for the current request, without fetching rows."""
    required_operations: tuple[WorkflowEngineAPIOperation, ...]

    match _API_OPERATIONS_BY_NAME.get(operation):
        case WorkflowEngineAPIOperation.LIST:
            required_operations = (WorkflowEngineAPIOperation.GET, WorkflowEngineAPIOperation.LIST)

        case WorkflowEngineAPIOperation.DISCOVER:
            required_operations = (
                WorkflowEngineAPIOperation.GET,
                WorkflowEngineAPIOperation.DISCOVER,
            )

        case None:
            required_operations = ()

        case normalized_operation:
            required_operations = (normalized_operation,)

    excluded_types = []

    for type_slug, settings in settings_by_type.items():
        for required_operation in required_operations:
            if not is_api_operation_available(
                settings, required_operation, organization, actor=actor
            ):
                excluded_types.append(type_slug)

                break

    return excluded_types

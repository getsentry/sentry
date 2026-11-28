from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.workflow_engine.endpoints.utils.api_availability import get_excluded_types
from sentry.workflow_engine.registry import workflow_settings_registry
from sentry.workflow_engine.types import WorkflowEngineAPIOperation

if TYPE_CHECKING:
    from sentry.auth.principal import RequestPrincipal
    from sentry.models.organization import Organization


def get_excluded_workflow_types(
    operation: WorkflowEngineAPIOperation | str | None,
    organization: Organization,
    *,
    actor: RequestPrincipal | None = None,
) -> list[str]:
    return get_excluded_types(
        workflow_settings_registry.registrations, operation, organization, actor=actor
    )

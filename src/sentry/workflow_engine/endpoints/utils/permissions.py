from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.validators.utils import (
    validate_detectors_exist_and_have_permissions,
)
from sentry.workflow_engine.types import DetectorId

ORGANIZATION_WORKFLOW_WRITE_SCOPES = ("org:write", "org:admin", "alerts:write")


def enforce_workflow_creation_permissions(
    request: Request,
    organization: Organization,
    detector_ids: list[DetectorId] | None,
) -> None:
    """
    Users can create workflows with an organization-level write scope, or with access to
    every detector that will be connected to the workflow.
    """
    if any(request.access.has_scope(scope) for scope in ORGANIZATION_WORKFLOW_WRITE_SCOPES):
        return

    if not detector_ids:
        raise PermissionDenied

    validate_detectors_exist_and_have_permissions(detector_ids, organization, request)

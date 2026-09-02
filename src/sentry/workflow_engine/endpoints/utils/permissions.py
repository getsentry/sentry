from collections.abc import Sequence

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.validators.utils import (
    can_edit_detector_workflow_connections,
    validate_detectors_exist_and_have_permissions,
)
from sentry.workflow_engine.models import DetectorWorkflow, Workflow
from sentry.workflow_engine.types import DetectorId

ORGANIZATION_WORKFLOW_WRITE_SCOPES = ("org:write", "org:admin", "alerts:write")


def can_edit_workflows(workflows: Sequence[Workflow], request: Request) -> bool:
    """
    Determine if the requesting user can edit every workflow in the sequence.

    Organization alert writers can delete organization-level workflows. Otherwise,
    every workflow must be connected to at least one detector and the user must be
    able to edit every detector-workflow connection.
    """
    workflow_ids = {workflow.id for workflow in workflows}
    if not workflow_ids:
        return False

    if any(request.access.has_scope(scope) for scope in ORGANIZATION_WORKFLOW_WRITE_SCOPES):
        return True

    detector_workflows = list(
        DetectorWorkflow.objects.filter(workflow_id__in=workflow_ids).select_related(
            "detector", "detector__project"
        )
    )
    connected_workflow_ids = {
        detector_workflow.workflow_id for detector_workflow in detector_workflows
    }

    return workflow_ids == connected_workflow_ids and all(
        can_edit_detector_workflow_connections(detector_workflow.detector, request)
        for detector_workflow in detector_workflows
    )


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

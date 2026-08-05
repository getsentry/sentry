from rest_framework.request import Request

from sentry import features
from sentry.models.organization import Organization
from sentry.workflow_engine.models import Detector, Workflow
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


def is_all_projects_detector(detector: Detector, organization: Organization) -> bool:
    return (
        detector.project_id is None
        and detector.type == IssueStreamGroupType.slug
        and detector.config.get("organization_id") == organization.id
    )


def is_workflow_connected_to_all_projects_detector(workflow: Workflow) -> bool:
    return (
        Detector.objects.all_projects_for_organization(workflow.organization_id)
        .filter(detectorworkflow__workflow=workflow)
        .exists()
    )


def can_edit_all_project_detector_workflow_connections(request: Request) -> bool:
    return request.access.has_scope("org:write")


def should_include_all_projects_detector(request: Request, organization: Organization) -> bool:
    return (
        features.has("organizations:workflow-engine-all-projects-detector", organization)
        and request.method == "GET"
    )


def should_include_all_projects_detector_workflows(
    request: Request, organization: Organization
) -> bool:
    """
    The flag is always required to show these workflows, but if it isn't a GET request, also check
    that the caller has org:write. alerts:write is not sufficient to connect an all projects detector.
    """
    return features.has("organizations:workflow-engine-all-projects-detector", organization) and (
        request.method == "GET"
        or can_edit_all_project_detector_workflow_connections(request=request)
    )

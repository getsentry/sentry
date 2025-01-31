from rest_framework import status
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.api.validators.project_codeowners import validate_codeowners_associations
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners


@region_silo_endpoint
class OrganizationCodeOwnersAssociationsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    def get(self, request: Request, organization: Organization):
        """
        Returns all ProjectCodeOwners associations for an organization as a dict with projects as keys
        e.g. {"projectSlug": {associations: {...}, errors: {...}}, ...]
        """
        projects = Project.objects.filter(
            organization=organization,
            status=ObjectStatus.ACTIVE,
        )
        project_code_owners = ProjectCodeOwners.objects.filter(project__in=projects)
        provider = request.GET.get("provider")
        if provider:
            org_integrations = integration_service.get_organization_integrations(
                providers=[provider],
                organization_ids=[pco.project.organization_id for pco in project_code_owners],
            )
            project_code_owners = project_code_owners.filter(
                repository_project_path_config__organization_integration_id__in={
                    oi.id for oi in org_integrations
                }
            )
        result = {}
        for pco in project_code_owners:
            associations, errors = validate_codeowners_associations(pco.raw, pco.project)
            result[pco.project.slug] = {"associations": associations, "errors": errors}
        return self.respond(result, status=status.HTTP_200_OK)

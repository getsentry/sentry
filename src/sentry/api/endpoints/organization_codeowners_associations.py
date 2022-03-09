from rest_framework import status
from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ObjectStatus
from sentry.models import Organization, Project, ProjectCodeOwners


class OrganizationCodeOwnersAssociationsPermission(OrganizationPermission):
    scope_map = {"GET": ["org:integrations"]}


class OrganizationCodeOwnersAssociationsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationCodeOwnersAssociationsPermission,)

    def get(self, request: Request, organization: Organization):
        """
        Returns all ProjectCodeOwners associations for an organization as a dict with projects as keys
        e.g. {"projectSlug": {associations: {...}, errors: {...}}, ...]
        """
        projects = Project.objects.filter(
            organization=organization,
            status=ObjectStatus.VISIBLE,
        )
        project_code_owners = ProjectCodeOwners.objects.filter(project__in=projects)
        provider = request.GET.get("provider")
        if provider:
            project_code_owners = project_code_owners.filter(
                repository_project_path_config__organization_integration__integration__provider=provider
            )
        result = {}
        for pco in project_code_owners:
            associations, errors = ProjectCodeOwners.validate_codeowners_associations(
                pco.raw, pco.project
            )
            result[pco.project.slug] = {"associations": associations, "errors": errors}
        return self.respond(result, status=status.HTTP_200_OK)

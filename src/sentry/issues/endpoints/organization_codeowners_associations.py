from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationIntegrationsLoosePermission,
)
from sentry.api.validators.project_codeowners import CodeOwnersErrors, build_codeowners_associations
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.projectcodeowners import ProjectCodeOwners


class CodeOwnersProjectAssociationsResponse(TypedDict):
    associations: dict[str, str]
    errors: CodeOwnersErrors


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class OrganizationCodeOwnersAssociationsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    max_acceptable_duration = 3.0
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationIntegrationsLoosePermission,)

    @extend_schema(
        operation_id="listOrganizationCodeownersAssociations",
        summary="List Code Owner Associations",
        description=(
            "Return CODEOWNERS associations for projects the authenticated user is a member of. "
            "Specify `project` to filter the results."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                "project",
                type=str,
                many=True,
                description=(
                    "Filter by project ID or slug. Specify multiple values to include multiple projects. "
                    "Use `-1` to include all accessible projects."
                ),
            ),
            OpenApiParameter(
                "provider", type=str, description="Filter associations by integration provider."
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationCodeOwnersAssociationsResponse",
                dict[str, CodeOwnersProjectAssociationsResponse],
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[dict[str, CodeOwnersProjectAssociationsResponse]]:
        """
        Returns all ProjectCodeOwners associations for an organization as a dict with projects as keys
        e.g. {"projectSlug": {associations: {...}, errors: {...}}, ...]
        """
        projects = self.get_projects(request, organization)
        project_code_owners = ProjectCodeOwners.objects.filter(project__in=projects).select_related(
            "project", "repository_project_path_config"
        )
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
            associations, errors = build_codeowners_associations(
                pco.raw, pco.project, pco.repository_project_path_config
            )
            result[pco.project.slug] = {"associations": associations, "errors": errors}
        return self.respond(result, status=status.HTTP_200_OK)

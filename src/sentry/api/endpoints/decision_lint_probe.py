# Temporary file for testing decision-model-lint rules. Not for merging.
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.project import Project


@cell_silo_endpoint
class OrganizationDecisionLintProbeEndpoint(OrganizationEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        # E. New endpoint returning a growing list without pagination -> INTRODUCED (comment)
        projects = Project.objects.filter(organization_id=organization.id)
        return Response(serialize(list(projects), request.user))

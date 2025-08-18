from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.smokey.models.incidentcase import IncidentCase
from sentry.smokey.serializers.inbound import IncidentCaseInboundSerializer


@region_silo_endpoint
class OrganizationIncidentCaseIndexEndpoint(OrganizationEndpoint):
    """
    List all incident cases for an organization
    """

    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List all incident cases for an organization
        """
        queryset = IncidentCase.objects.filter(organization=organization)

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new incident case
        """
        serializer = IncidentCaseInboundSerializer(
            data=request.data, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)

        incident_case = IncidentCase.objects.create(
            organization=organization, **serializer.validated_data
        )

        return self.respond(serialize(incident_case), status=201)

from __future__ import annotations

from django.db import router, transaction
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.integrations.slack.smokey.create_incident import post_create_flow
from sentry.models.organization import Organization
from sentry.smokey.models.incidentcase import IncidentCase
from sentry.smokey.models.incidentcomponent import IncidentCaseComponent
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

        affected_components = serializer.validated_data.pop("affected_components")

        with transaction.atomic(using=router.db_for_write(IncidentCase)):
            incident_case = IncidentCase.objects.create(
                organization=organization,
                **serializer.validated_data,
                started_at=timezone.now(),
            )

            for component in affected_components:
                IncidentCaseComponent.objects.create(case=incident_case, component_id=component)

        post_create_flow(incident_case)

        return self.respond(serialize(incident_case), status=201)

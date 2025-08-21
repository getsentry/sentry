from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate
from sentry.smokey.serializers.inbound import IncidentCaseTemplateInboundSerializer


@region_silo_endpoint
class OrganizationIncidentCaseTemplateIndexEndpoint(OrganizationEndpoint):
    """
    Create a new incident case template
    """

    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List the first incident case template for an organization
        (obviously this is a hack to get the template for the demo)
        """
        template = IncidentCaseTemplate.objects.filter(organization=organization).first()
        if template:
            return self.respond(serialize(template))
        return self.respond()

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new incident case template
        """
        serializer = IncidentCaseTemplateInboundSerializer(
            data=request.data, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)

        new_template = IncidentCaseTemplate.objects.create(
            organization=organization, **serializer.validated_data
        )

        return self.respond(serialize(new_template), status=201)

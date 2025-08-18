from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate
from sentry.smokey.serializers.inbound import IncidentCaseTemplateInboundSerializer


@region_silo_endpoint
class OrganizationIncidentCaseTemplateDetailsEndpoint(OrganizationEndpoint):
    """
    Retrieve, update, or delete an incident case template
    """

    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug,
        template_id,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        try:
            kwargs["template"] = IncidentCaseTemplate.objects.get(
                id=template_id,
                organization=kwargs["organization"],
            )
        except IncidentCaseTemplate.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def get(
        self, request: Request, organization: Organization, template: IncidentCaseTemplate
    ) -> Response:
        """
        Retrieve an incident case template
        """
        return self.respond(serialize(template))

    def put(
        self, request: Request, organization: Organization, template: IncidentCaseTemplate
    ) -> Response:
        """
        Update an incident case template
        """
        serializer = IncidentCaseTemplateInboundSerializer(
            data=request.data, partial=True, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            if hasattr(template, field):
                setattr(template, field, value)

        template.save()

        return self.respond(serialize(template))

    def delete(
        self, request: Request, organization: Organization, template: IncidentCaseTemplate
    ) -> Response:
        """
        Delete an incident case template
        """
        template.delete()

        return self.respond(status=204)

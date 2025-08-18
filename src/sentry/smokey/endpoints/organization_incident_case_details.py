from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.smokey.models.incidentcase import IncidentCase
from sentry.smokey.serializers.inbound import IncidentCaseInboundSerializer


@region_silo_endpoint
class OrganizationIncidentCaseDetailsEndpoint(OrganizationEndpoint):
    """
    Retrieve, update, or delete an incident case
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
        case_id,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        try:
            kwargs["case"] = IncidentCase.objects.get(
                id=case_id,
                organization=kwargs["organization"],
            )
        except IncidentCase.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def get(self, request: Request, organization: Organization, case: IncidentCase) -> Response:
        """
        Retrieve an incident case
        """
        return self.respond(serialize(case))

    def put(self, request: Request, organization: Organization, case: IncidentCase) -> Response:
        """
        Update an incident case
        """
        serializer = IncidentCaseInboundSerializer(
            data=request.data, partial=True, context={"organization": organization}
        )
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as e:
            return self.respond(e.detail, status=400)

        for field, value in serializer.validated_data.items():
            if hasattr(case, field):
                setattr(case, field, value)

        case.save()

        return self.respond(serialize(case))

    def delete(self, request: Request, organization: Organization, case: IncidentCase) -> Response:
        """
        Delete an incident case
        """
        case.delete()

        return self.respond(status=204)

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
from sentry.smokey.models.incidentcomponents import IncidentComponent
from sentry.smokey.serializers.inbound import IncidentComponentInboundSerializer


@region_silo_endpoint
class OrganizationIncidentComponentDetailsEndpoint(OrganizationEndpoint):
    """
    Retrieve, update, or delete an incident component
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
        component_id,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)
        try:
            kwargs["component"] = IncidentComponent.objects.get(
                id=component_id,
                organization=kwargs["organization"],
            )
        except IncidentComponent.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def get(
        self, request: Request, organization: Organization, component: IncidentComponent
    ) -> Response:
        """
        Retrieve an incident component
        """
        return self.respond(serialize(component))

    def put(
        self, request: Request, organization: Organization, component: IncidentComponent
    ) -> Response:
        """
        Update an incident component
        """
        serializer = IncidentComponentInboundSerializer(
            data=request.data, partial=True, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            if hasattr(component, field):
                setattr(component, field, value)

        component.save()

        return self.respond(serialize(component))

    def delete(
        self, request: Request, organization: Organization, component: IncidentComponent
    ) -> Response:
        """
        Delete an incident component
        """
        IncidentComponent.objects.filter(parent_component=component).update(parent_component=None)
        component.delete()

        return self.respond(status=204)

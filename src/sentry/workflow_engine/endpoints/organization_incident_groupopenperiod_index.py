from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationDetectorPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.workflow_engine.endpoints.serializers.incident_groupopenperiod_serializer import (
    IncidentGroupOpenPeriodSerializer,
)
from sentry.workflow_engine.endpoints.validators.incident_groupopenperiod import (
    IncidentGroupOpenPeriodValidator,
)
from sentry.workflow_engine.models.incident_groupopenperiod import IncidentGroupOpenPeriod


@region_silo_endpoint
class OrganizationIncidentGroupOpenPeriodIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationDetectorPermission,)

    @extend_schema(
        operation_id="Fetch Incident and Group Open Period Relationship",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: IncidentGroupOpenPeriodSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request, organization):
        """
        Returns an incident and group open period relationship.
        Can optionally filter by incident_id, incident_identifier, group_id, or open_period_id.
        """
        validator = IncidentGroupOpenPeriodValidator(data=request.query_params)
        validator.is_valid(raise_exception=True)
        incident_id = validator.validated_data.get("incident_id")
        incident_identifier = validator.validated_data.get("incident_identifier")
        group_id = validator.validated_data.get("group_id")
        open_period_id = validator.validated_data.get("open_period_id")

        queryset = IncidentGroupOpenPeriod.objects.filter(
            group_open_period__project__organization=organization
        )

        if incident_id:
            queryset = queryset.filter(incident_id=incident_id)

        if incident_identifier:
            queryset = queryset.filter(incident_identifier=incident_identifier)

        if group_id:
            queryset = queryset.filter(group_open_period__group_id=group_id)

        if open_period_id:
            queryset = queryset.filter(group_open_period_id=open_period_id)

        incident_groupopenperiod = queryset.first()
        if not incident_groupopenperiod:
            raise ResourceDoesNotExist

        return Response(serialize(incident_groupopenperiod, request.user))

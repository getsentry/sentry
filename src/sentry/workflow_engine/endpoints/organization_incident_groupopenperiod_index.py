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
from sentry.incidents.endpoints.serializers.utils import get_object_id_from_fake_id
from sentry.models.groupopenperiod import GroupOpenPeriod
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
        If incident_identifier is provided but no match is found, falls back to calculating
        open_period_id by subtracting 10^9 from the incident_identifier and looking up the
        GroupOpenPeriod directly.
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

        if incident_groupopenperiod:
            return Response(serialize(incident_groupopenperiod, request.user))

        # Fallback: if incident_identifier or incident_id was provided but no IGOP found,
        # try looking up GroupOpenPeriod directly using calculated open_period_id
        fake_id = incident_identifier or incident_id
        if fake_id:
            calculated_open_period_id = get_object_id_from_fake_id(int(fake_id))
            gop_queryset = GroupOpenPeriod.objects.filter(
                id=calculated_open_period_id,
                project__organization=organization,
            )

            if group_id:
                gop_queryset = gop_queryset.filter(group_id=group_id)

            if open_period_id:
                gop_queryset = gop_queryset.filter(id=open_period_id)

            group_open_period = gop_queryset.first()

            if group_open_period:
                # Serialize the GroupOpenPeriod as if it were an IncidentGroupOpenPeriod
                return Response(
                    {
                        "incidentId": str(fake_id),
                        "incidentIdentifier": str(fake_id),
                        "groupId": str(group_open_period.group_id),
                        "openPeriodId": str(group_open_period.id),
                    }
                )

        raise ResourceDoesNotExist

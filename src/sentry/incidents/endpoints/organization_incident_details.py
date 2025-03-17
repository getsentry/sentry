from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializer
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod


class IncidentSerializer(serializers.Serializer):
    status = serializers.IntegerField()
    comment = serializers.CharField(required=False, allow_null=True)

    def validate_status(self, value):
        try:
            value = IncidentStatus(value)
        except Exception:
            raise serializers.ValidationError(
                "Invalid value for status. Valid values: {}".format(
                    [e.value for e in IncidentStatus]
                )
            )
        return value


@region_silo_endpoint
class OrganizationIncidentDetailsEndpoint(IncidentEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (IncidentPermission,)

    def get(self, request: Request, organization, incident) -> Response:
        """
        Fetch an Incident.
        ``````````````````
        :auth: required
        """
        data = serialize(incident, request.user, DetailedIncidentSerializer())

        return Response(data)

    def put(self, request: Request, organization, incident) -> Response:
        serializer = IncidentSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.validated_data
            if result["status"] == IncidentStatus.CLOSED:
                incident = update_incident_status(
                    incident=incident,
                    status=result["status"],
                    status_method=IncidentStatusMethod.MANUAL,
                )
                return Response(
                    serialize(incident, request.user, DetailedIncidentSerializer()), status=200
                )
            else:
                return Response("Status cannot be changed.", status=400)
        return Response(serializer.errors, status=400)

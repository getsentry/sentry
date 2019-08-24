from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.incident import DetailedIncidentSerializer
from sentry.incidents.logic import StatusAlreadyChangedError, update_incident_status
from sentry.incidents.models import IncidentStatus


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


class OrganizationIncidentDetailsEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission,)

    def get(self, request, organization, incident):
        """
        Fetch an Incident.
        ``````````````````
        :auth: required
        """
        data = serialize(incident, request.user, DetailedIncidentSerializer())

        return Response(data)

    def put(self, request, organization, incident):
        serializer = IncidentSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.validated_data

            try:
                incident = update_incident_status(
                    incident=incident,
                    status=result["status"],
                    user=request.user,
                    comment=result.get("comment"),
                )
            except StatusAlreadyChangedError:
                return Response("Status is already set to {}".format(result["status"]), status=400)

            return Response(
                serialize(incident, request.user, DetailedIncidentSerializer()), status=200
            )
        return Response(serializer.errors, status=400)

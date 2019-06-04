from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.incident import IncidentPermission, IncidentEndpoint
from sentry.api.serializers import serialize
from sentry.incidents.logic import create_incident_activity
from sentry.incidents.models import IncidentActivityType


class CommentSerializer(serializers.Serializer):
    comment = serializers.CharField(required=True)


class OrganizationIncidentCommentIndexEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission, )

    def post(self, request, organization, incident):
        serializer = CommentSerializer(data=request.DATA)
        if serializer.is_valid():
            activity = create_incident_activity(
                incident,
                IncidentActivityType.COMMENT,
                user=request.user,
                comment=serializer.object['comment']
            )
            return Response(serialize(activity, request.user), status=201)
        return Response(serializer.errors, status=400)

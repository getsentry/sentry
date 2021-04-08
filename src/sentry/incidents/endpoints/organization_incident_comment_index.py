from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.api.fields.actor import ActorField
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.list import ListField
from sentry.api.serializers.rest_framework.mentions import (
    MentionsMixin,
    extract_user_ids_from_mentions,
)
from sentry.incidents.logic import create_incident_activity
from sentry.incidents.models import IncidentActivityType


class CommentSerializer(serializers.Serializer, MentionsMixin):
    comment = serializers.CharField(required=True)
    mentions = ListField(child=ActorField(), required=False)
    external_id = serializers.CharField(allow_null=True, required=False)


class OrganizationIncidentCommentIndexEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission,)

    def post(self, request, organization, incident):
        serializer = CommentSerializer(
            data=request.data,
            context={"projects": incident.projects.all(), "organization_id": organization.id},
        )
        if serializer.is_valid():
            mentions = extract_user_ids_from_mentions(
                organization.id, serializer.validated_data.get("mentions", [])
            )
            mentioned_user_ids = mentions["users"] | mentions["team_users"]
            activity = create_incident_activity(
                incident,
                IncidentActivityType.COMMENT,
                user=request.user,
                comment=serializer.validated_data["comment"],
                mentioned_user_ids=mentioned_user_ids,
            )
            return Response(serialize(activity, request.user), status=201)
        return Response(serializer.errors, status=400)

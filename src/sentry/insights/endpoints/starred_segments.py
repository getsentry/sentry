from django.db import router
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.insights.models import InsightsStarredSegment
from sentry.models.organization import Organization
from sentry.utils.db import atomic_transaction


class StarSegmentSerializer(serializers.Serializer):
    segment_name = serializers.CharField(required=True)
    project_id = serializers.IntegerField(required=True)


class MemberPermission(OrganizationPermission):
    scope_map = {
        "POST": ["member:read", "member:write"],
        "DELETE": ["member:read", "member:write"],
    }


@region_silo_endpoint
class InsightsStarredSegmentsEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (MemberPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:insights-modules-use-eap", organization, actor=request.user
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Star a segment for the current organization member.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = StarSegmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        segment_name = serializer.validated_data["segment_name"]
        project_id = serializer.validated_data["project_id"]
        with atomic_transaction(using=router.db_for_write(InsightsStarredSegment)):
            _, created = InsightsStarredSegment.objects.get_or_create(
                organization=organization,
                project_id=project_id,
                user_id=request.user.id,
                segment_name=segment_name,
            )

            if not created:
                return Response(status=status.HTTP_403_FORBIDDEN)

        return Response(status=status.HTTP_200_OK)

    def delete(self, request: Request, organization: Organization) -> Response:
        """
        Delete a starred segment for the current organization member.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = StarSegmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        segment_name = serializer.validated_data["segment_name"]
        project_id = serializer.validated_data["project_id"]

        InsightsStarredSegment.objects.filter(
            organization=organization,
            user_id=request.user.id,
            project_id=project_id,
            segment_name=segment_name,
        ).delete()

        return Response(status=status.HTTP_200_OK)

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.release_threshold.release_threshold import ReleaseThreshold


class ReleaseThresholdIndexGETSerializer(serializers.Serializer):
    environment = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField()
    )
    project = serializers.ListField(
        required=True, allow_empty=False, child=serializers.IntegerField()
    )


@region_silo_endpoint
class ReleaseThresholdEndpoint(ProjectEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> HttpResponse:
        serializer = ReleaseThresholdIndexGETSerializer(
            data=request.query_params,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        environments_list = serializer.validated_data.get("environment")
        project_ids_list = serializer.validated_data.get("project")

        release_query = Q()
        if environments_list:
            release_query &= Q(
                environment__name__in=environments_list,
            )
        if project_ids_list:
            release_query &= Q(
                project__id__in=project_ids_list,
            )

        release_thresholds = ReleaseThreshold.objects.filter(release_query)

        return Response(serialize(list(release_thresholds), request.user), status=200)

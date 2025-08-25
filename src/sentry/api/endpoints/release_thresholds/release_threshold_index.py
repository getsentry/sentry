from django.db.models import Q
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.release_threshold.release_threshold import ReleaseThreshold


class ReleaseThresholdIndexGETValidator(serializers.Serializer):
    environment = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField()
    )
    project = serializers.ListField(
        required=True, allow_empty=False, child=serializers.IntegerField()
    )


@region_silo_endpoint
class ReleaseThresholdIndexEndpoint(OrganizationEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> HttpResponse:
        validator = ReleaseThresholdIndexGETValidator(
            data=request.query_params,
        )
        if not validator.is_valid():
            return Response(validator.errors, status=400)

        environments_list = self.get_environments(request, organization)
        projects_list = self.get_projects(request, organization)

        release_query = Q()
        if environments_list:
            release_query &= Q(
                environment__in=environments_list,
            )
        if projects_list:
            release_query &= Q(
                project__in=projects_list,
            )

        queryset = ReleaseThreshold.objects.filter(release_query)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

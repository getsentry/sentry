from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING

from django.db.models import F, Q
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.models import Release
from sentry.services.hybrid_cloud.organization import RpcOrganization

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class ReleaseStatusIndexSerializer(serializers.Serializer):
    start = serializers.DateTimeField(
        help_text="This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
        "Use along with `end`",
        required=True,
    )
    end = serializers.DateTimeField(
        help_text=(
            "This defines the inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
            "Use along with `start`"
        ),
        required=True,
    )
    environments = serializers.ListField(required=False, allow_null=True, allow_empty=True)
    projects = serializers.ListField(required=False, allow_null=True, allow_empty=True)
    release_ids = serializers.ListField(required=False, allow_null=True, allow_empty=True)

    def validate(self, data):
        if data.start >= data.end:
            raise serializers.ValidationError("Start datetime must be after End")


@region_silo_endpoint
class ReleaseStatusIndexEndpoint(OrganizationReleasesBaseEndpoint, EnvironmentMixin):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization | RpcOrganization) -> HttpResponse:
        """
        List all derived statuses of releases that fall within the provided start/end datetimes
        limit results?
        We can probably just copy the OrganizationReleasesStatsEndpoint
        Maybe we can tack in the threshold health into that api? but may be overcomplicating and expanding its scope...
        inherit?
        helper method?
        """
        data = request.data if len(request.GET) == 0 and hasattr(request, "data") else request.GET
        start, end = get_date_range_from_params(params=data)
        environments_list = request.GET.getlist("environment")
        project_ids_list = request.GET.getlist("project")
        release_ids_list = request.GET.getlist("release_id")

        serializer = ReleaseStatusIndexSerializer(
            data=request.query_params,
            context={  # do we need to pass in extra context?
                "organization": organization,
                "access": request.access,
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        release_query = Q(organization=organization)
        environments = self.get_environments(request, organization)
        if environments:
            environments_list = [env.name for env in environments]
            release_query &= Q(
                releaseprojectenvironment__environment__name__in=environments_list,
            )
        if project_ids_list:
            release_query &= Q(
                project_id__in=project_ids_list,
            )
        if release_ids_list:
            release_query &= Q(
                id__in=release_ids_list,
            )

        queryset = (
            Release.objects.filter(release_query)
            .annotate(
                date=F("date_added"),  # transforms date_added into 'date'
            )
            .order_by("-date")
            .distinct()
        )
        # NOTE: we're only filtering on date ADDED
        # This is not synonymous with a deploy... which may be what we actually want.
        queryset = queryset.filter(date__gte=start, date__lte=end)
        if release_ids_list:
            queryset = queryset.filter(id__in=release_ids_list)

        queryset.prefetch_related("projects__release_thresholds")

        # ========================================================================
        # TODO:
        # Determine which thresholds have succeeded/failed

        release_threshold_health = defaultdict(list)

        for release in queryset:
            for project in release.projects.all():
                for threshold in project.release_thresholds.all():
                    # thresholds are per proj/env
                    # releases can belong to multiple projects...
                    # So - we'll need to calcualte the threshold health. index on project
                    """
                    health = {
                        release_id: {
                            project_id: [threshold1, threshold2],
                            project_id: [threshold1, threshold2],
                        }
                    }
                    """
                    release_threshold_health[project.id].append(threshold.id)
                    # print(threshold)
        #             calculate_threshold_health(r, p, threshold)

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
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models import Release

# from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType as ReleaseThresholdTriggerType
from sentry.services.hybrid_cloud.organization import RpcOrganization

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class ReleaseThresholdStatusIndexSerializer(serializers.Serializer):
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
    environment = serializers.ListField(
        required=False, allow_empty=True, child=serializers.CharField()
    )
    project = serializers.ListField(
        required=False, allow_empty=True, child=serializers.IntegerField()
    )
    release_id = serializers.ListField(
        required=False, allow_empty=True, child=serializers.IntegerField()
    )

    def validate(self, data):
        if data["start"] >= data["end"]:
            raise serializers.ValidationError("Start datetime must be after End")
        return data


@region_silo_endpoint
class ReleaseThresholdStatusIndexEndpoint(OrganizationReleasesBaseEndpoint, EnvironmentMixin):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization | RpcOrganization) -> HttpResponse:
        """
        List all derived statuses of releases that fall within the provided start/end datetimes

        Constructs a nested response key'd off release_id, project_id, and lists _all_ thresholds for specified project
        Each returned threshold value will contain the full serialized release_threshold instance as well as it's derived health status

        health = {
            release_id: {
                project_id: [
                    {
                        threshold_id,
                        project,
                        ...,
                        is_healthy: True/False
                    },
                    {...},
                ],
                project2_id: [],
                ...
            },
            ...
        }
        ``````````````````

        :param start: timestamp of the beginning of the specified date range
        :param end: timestamp of the end of the specified date range

        TODO:
        - should we limit/paginate results? (this could get really bulky)
        """
        data = request.data if len(request.GET) == 0 and hasattr(request, "data") else request.GET
        start, end = get_date_range_from_params(params=data)

        serializer = ReleaseThresholdStatusIndexSerializer(
            data=request.query_params,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        environments_list = serializer.validated_data.get("environment")
        project_ids_list = serializer.validated_data.get("project")
        release_ids_list = serializer.validated_data.get("release_id")

        # NOTE: we're only filtering on date ADDED
        # This is not synonymous with a deploy... which may be what we actually want.
        release_query = Q(organization=organization, date_added__gte=start, date_added__lte=end)
        environments = self.get_environments(request, organization)
        if environments:
            environments_list = [env.name for env in environments]
            release_query &= Q(
                releaseprojectenvironment__environment__name__in=environments_list,
            )
        if project_ids_list:
            release_query &= Q(
                projects__id__in=project_ids_list,
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
        queryset.prefetch_related("projects__release_thresholds")

        # ========================================================================
        # TODO:
        # Fetch relevant snuba/sessions data
        # Determine which thresholds have succeeded/failed

        release_threshold_health = defaultdict()
        for release in queryset:
            release_project = defaultdict(list)
            if project_ids_list:
                project_list = release.projects.filter(id__in=project_ids_list)
            else:
                project_list = release.projects.all()
            for project in project_list:
                project_threshold_statuses = []
                for threshold in project.release_thresholds.all():
                    is_healthy = self.is_threshold_healthy(threshold)
                    project_threshold_statuses.append(
                        {
                            **serialize(threshold),
                            "is_healthy": is_healthy,
                        }
                    )
                release_project[project.id] = project_threshold_statuses
            release_threshold_health[release.id] = release_project

        return Response(release_threshold_health, status=200)

    def is_threshold_healthy(self, threshold) -> bool:
        """
        Determines whether a projects threshold has been breached or not
        True - healthy
        False - unhealthy
        """
        # TODO:
        # for each threshold type - determine how to properly pull the data?
        # threshold_type = threshold.threshold_type
        # trigger_type = threshold.trigger_type
        # value = threshold.value
        # window = threshold.window_in_seconds
        # project = threshold.project
        # environment = threshold.environment

        """
        Does each threshold type turn into a query string?
        DD - has query formula that is run

        Dig to see where we fetch this data today
        """

        return True

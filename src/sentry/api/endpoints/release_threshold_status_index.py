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

# from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
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
    environments = serializers.ListField(required=False, allow_null=True, allow_empty=True)
    projects = serializers.ListField(required=False, allow_null=True, allow_empty=True)
    release_ids = serializers.ListField(required=False, allow_null=True, allow_empty=True)

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
        ``````````````````

        :param start: timestamp of the beginning of the specified date range
        :param end: timestamp of the end of the specified date range

        TODO:
        - should we limit/paginate results? (this could get really bulky)
        """
        data = request.data if len(request.GET) == 0 and hasattr(request, "data") else request.GET
        start, end = get_date_range_from_params(params=data)
        environments_list = request.GET.getlist("environment")
        project_ids_list = request.GET.getlist("project")
        release_ids_list = request.GET.getlist("release_id")

        serializer = ReleaseThresholdStatusIndexSerializer(
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
        """
        Constructs a nested response key'd off release_id, project_id, and threshold_id
        each threshold value will contain the full release_threshold instance as well as it's derived health status
        health = {
            release_id: {
                project_id: [{
                    ...,
                    is_healthy: True/False
                }],
                ...
            }
        }
        """

        release_threshold_health = defaultdict(list)

        for release in queryset:
            for project in release.projects.all():
                project_threshold_statuses = []
                for threshold in project.release_thresholds.all():
                    is_healthy = self.is_threshold_healthy(threshold)
                    project_threshold_statuses.append(
                        {
                            **serialize(threshold),
                            "is_healthy": is_healthy,
                        }
                    )
                release_threshold_health[release.id] = project_threshold_statuses

        return Response(release_threshold_health, status=200)

    def is_threshold_healthy(self, threshold) -> bool:
        """
        Determines whether a projects threshold has been breached or not
        True - healthy
        False - unhealthy
        """
        # TOTAL_ERROR_COUNT_STR = "total_error_count" - Can we even get a % over/under for errors?
        # NEW_ISSUE_COUNT_STR = "new_issue_count" - What is a % over/under for new issues??
        # UNHANDLED_ISSUE_COUNT_STR = "unhandled_issue_count" - count & % makes sense
        # REGRESSED_ISSUE_COUNT_STR = "regressed_issue_count" - count & % makes sense
        # FAILURE_RATE_STR = "failure_rate" - Count does not make sense
        # CRASH_FREE_SESSION_RATE_STR = "crash_free_session_rate" - Count does not make sense
        # CRASH_FREE_USER_RATE_STR = "crash_free_user_rate" - Count does not make sense
        # TODO:
        # for each threshold type - determine how to properly pull the data?
        # PERCENT_OVER_STR = "percent_over"
        # PERCENT_UNDER_STR = "percent_under"
        # ABSOLUTE_OVER_STR = "absolute_over"
        # ABSOLUTE_UNDER_STR = "absolute_under"

        # threshold_type = threshold.threshold_type
        # trigger_type = threshold.trigger_type
        # value = threshold.value
        # window = threshold.window_in_seconds
        # project = threshold.project
        # environment = threshold.environment

        return True

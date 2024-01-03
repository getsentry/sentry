from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Tuple

from dateutil import parser
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.endpoints.release_thresholds.utils import (
    get_errors_counts_timeseries_by_project_and_release,
)
from sentry.api.utils import get_date_range_from_params
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.releases.servicer import EnrichedThreshold, ReleaseThresholdServicer
from sentry.services.hybrid_cloud.organization import RpcOrganization
from sentry.utils import metrics

logger = logging.getLogger("sentry.release_threshold_status")

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project


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
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("Provide a list of environment names to filter your results by"),
    )
    project = serializers.ListField(
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("Provide a list of project slugs to filter your results by"),
    )
    release = serializers.ListField(
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("Provide a list of release versions to filter your results by"),
    )

    def validate(self, data):
        if data["start"] >= data["end"]:
            raise serializers.ValidationError("Start datetime must be after End")
        return data


@region_silo_endpoint
class ReleaseThresholdStatusIndexEndpoint(OrganizationReleasesBaseEndpoint, EnvironmentMixin):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.servicer = ReleaseThresholdServicer()

    def get(self, request: Request, organization: Organization | RpcOrganization) -> HttpResponse:
        """
        List all derived statuses of releases that fall within the provided start/end datetimes

        Constructs a response key'd off release_version, project_slug, and lists thresholds with their status for *specified* projects
        Each returned enriched threshold will contain the full serialized release_threshold instance as well as it's derived health status

        {
            {proj}-{release}: [
                {
                    project_id,
                    project_slug,
                    environment,
                    ...,
                    key: {release}-{proj},
                    release_version: '',
                    is_healthy: True/False,
                    start: datetime,
                    end: datetime,
                    metric_value: int,
                },
                {...},
                {...}
            ],
            {proj}-{release}: [...],
        }

        ``````````````````

        :param start: timestamp of the beginning of the specified date range
        :param end: timestamp of the end of the specified date range

        TODO:
        - should we limit/paginate results? (this could get really bulky)
        """
        # ========================================================================
        # STEP 1: Validate request data
        #
        # NOTE: start/end parameters determine window to query for releases
        # This is NOT the window to query snuba for event data - nor the individual threshold windows
        # ========================================================================
        data = request.data if len(request.GET) == 0 and hasattr(request, "data") else request.GET
        start: datetime
        end: datetime
        start, end = get_date_range_from_params(params=data)
        logger.info(
            "Checking release status health",
            extra={
                "start": start,
                "end": end,
            },
        )
        metrics.incr("release.threshold_health_status.attempt")

        serializer = ReleaseThresholdStatusIndexSerializer(
            data=request.query_params,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        environments_list = serializer.validated_data.get("environment")
        project_slug_list = serializer.validated_data.get("project")
        releases_list = serializer.validated_data.get("release")

        """
        Get flattened data for release thresholds
        """
        flattened_thresholds = self.servicer.get_thresholds_by_type(
            organization=organization,
            start=start,
            end=end,
            environments=environments_list,
            project_slugs=project_slug_list,
            versions=releases_list,
        )
        thresholds_by_type = flattened_thresholds.thresholds_by_type
        query_windows_by_type = flattened_thresholds.query_windows_by_type

        # ========================================================================
        # Step 4: Determine threshold status per threshold type and return results
        # ========================================================================
        release_threshold_health = defaultdict(list)
        for threshold_type, filter_list in thresholds_by_type.items():
            project_id_list = [proj_id for proj_id in filter_list["project_ids"]]
            release_value_list = [release_version for release_version in filter_list["releases"]]
            category_thresholds: List[EnrichedThreshold] = filter_list["thresholds"]
            if threshold_type == ReleaseThresholdType.TOTAL_ERROR_COUNT:
                metrics.incr("release.threshold_health_status.check.error_count")
                """
                Fetch errors timeseries for all projects with an error_count threshold in desired releases
                Iterate through timeseries given threshold window and determine health status

                NOTE: Timeseries query start & end are determined by API param window (_not_ threshold window)
                    derived from fetched releases (earliest start & latest end)
                    IF the param window doesn't cover the full threshold window, results will be inaccurate

                TODO: If too many results, then throw an error and request user to narrow their search window
                """
                query_window = query_windows_by_type[threshold_type]
                error_counts = get_errors_counts_timeseries_by_project_and_release(
                    end=query_window["end"],
                    environments_list=environments_list,
                    organization_id=organization.id,
                    project_id_list=project_id_list,
                    release_value_list=release_value_list,
                    start=query_window["start"],
                )
                logger.info(
                    "querying error counts",
                    extra={
                        "start": query_window["start"],
                        "end": query_window["end"],
                        "project_ids": project_id_list,
                        "releases": release_value_list,
                        "environments": environments_list,
                        "error_count_data": error_counts,
                    },
                )
                for ethreshold in category_thresholds:
                    is_healthy, metric_count = is_error_count_healthy(ethreshold, error_counts)
                    ethreshold.update({"is_healthy": is_healthy, "metric_value": metric_count})
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.NEW_ISSUE_COUNT:
                metrics.incr("release.threshold_health_status.check.new_issue_count")
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.UNHANDLED_ISSUE_COUNT:
                metrics.incr("release.threshold_health_status.check.unhandled_issue_count")
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.REGRESSED_ISSUE_COUNT:
                metrics.incr("release.threshold_health_status.check.regressed_issue_count")
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.FAILURE_RATE:
                metrics.incr("release.threshold_health_status.check.failure_rate")
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.CRASH_FREE_SESSION_RATE:
                metrics.incr("release.threshold_health_status.check.crash_free_session_rate")
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.CRASH_FREE_USER_RATE:
                metrics.incr("release.threshold_health_status.check.crash_free_user_rate")
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key

        return Response(release_threshold_health, status=200)

    def construct_threshold_key(self, project: Project, release: Release) -> str:
        """
        Consistent key helps to determine which thresholds can be grouped together.
        project_slug - release_version

        NOTE: release versions can contain special characters... `-` delimiter may not be appropriate
        TODO: move this into a separate helper?
        """
        return f"{project.slug}-{release.version}"


def is_error_count_healthy(
    ethreshold: EnrichedThreshold, timeseries: List[Dict[str, Any]]
) -> Tuple[bool, int]:
    """
    Iterate through timeseries given threshold window and determine health status
    enriched threshold (ethreshold) includes `start`, `end`, and a constructed `key` identifier
    """
    total_count = 0
    threshold_environment: str | None = (
        ethreshold["environment"]["name"] if ethreshold["environment"] else None
    )
    sorted_series = sorted(timeseries, key=lambda x: x["time"])
    for i in sorted_series:
        if parser.parse(i["time"]) > ethreshold["end"]:
            # timeseries are ordered chronologically
            # So if we're past our threshold.end, we can skip the rest
            logger.info("Reached end of threshold window. Breaking")
            metrics.incr("release.threshold_health_status.is_error_count_healthy.break_loop")
            break
        if (
            parser.parse(i["time"]) <= ethreshold["start"]  # ts is before our threshold start
            or parser.parse(i["time"]) > ethreshold["end"]  # ts is after our threshold end
            or i["release"] != ethreshold["release"]  # ts is not our the right release
            or i["project_id"] != ethreshold["project_id"]  # ts is not the right project
            or i["environment"] != threshold_environment  # ts is not the right environment
        ):
            metrics.incr("release.threshold_health_status.is_error_count_healthy.skip")
            continue
        # else ethreshold.start < i.time <= ethreshold.end
        metrics.incr("release.threshold_health_status.is_error_count_healthy.aggregate_total")
        total_count += i["count()"]

    logger.info(
        "is_error_count_healthy",
        extra={
            "threshold": ethreshold,
            "total_count": total_count,
            "error_count_data": timeseries,
            "threshold_environment": threshold_environment,
        },
    )

    if ethreshold["trigger_type"] == TriggerType.OVER_STR:
        # If total is under/equal the threshold value, then it is healthy
        return total_count <= ethreshold["value"], total_count

    # Else, if total is over/equal the threshold value, then it is healthy
    return total_count >= ethreshold["value"], total_count

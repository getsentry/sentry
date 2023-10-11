from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any, DefaultDict, Dict, List, TypedDict

from dateutil import parser
from django.db.models import F, Q
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
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.services.hybrid_cloud.organization import RpcOrganization

if TYPE_CHECKING:
    from sentry.models.environment import Environment
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.release_threshold.release_threshold import ReleaseThreshold


class SerializedThreshold(TypedDict):
    date: datetime
    environment: Environment | None
    project: Project
    release: str
    threshold_type: int
    trigger_type: int
    value: int
    window_in_seconds: int


class EnrichedThreshold(SerializedThreshold):
    end: datetime
    is_healthy: bool
    key: str
    project_id: int
    start: datetime


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
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization | RpcOrganization) -> HttpResponse:
        """
        List all derived statuses of releases that fall within the provided start/end datetimes

        Constructs a response key'd off release_id, project_id, environment, and lists thresholds with their status for *specified* projects
        Each returned enriched threshold will contain the full serialized release_threshold instance as well as it's derived health status

        {
            {proj}-{env}-{release}: [
                {
                    project_id,
                    environment,
                    ...,
                    key: {release}-{proj}-{env},
                    release_version: '',
                    is_healthy: True/False,
                    start: datetime,
                    end: datetime,
                },
                {...},
                {...}
            ],
            {proj}-{env}-{release}: [...],
        }

        ``````````````````

        :param start: timestamp of the beginning of the specified date range
        :param end: timestamp of the end of the specified date range

        TODO:
        - should we limit/paginate results? (this could get really bulky)
        """
        # ========================================================================
        # STEP 1: Validate request data
        # ========================================================================
        data = request.data if len(request.GET) == 0 and hasattr(request, "data") else request.GET
        start: datetime
        end: datetime
        start, end = get_date_range_from_params(params=data)

        serializer = ReleaseThresholdStatusIndexSerializer(
            data=request.query_params,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        environments_list = serializer.validated_data.get("environment")
        project_ids_list = serializer.validated_data.get("project")
        release_ids_list = serializer.validated_data.get("release_id")

        # ========================================================================
        # Step 2: Fetch releases, prefetch projects & release_thresholds
        # NOTE: we're only filtering on date ADDED
        # This is not synonymous with a deploy... which may be what we actually want.
        # ========================================================================
        release_query = Q(organization=organization, date_added__gte=start, date_added__lte=end)
        if environments_list:
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
        queryset.prefetch_related(
            "projects__release_thresholds"
        )  # maybe prefetch "deploy_set" as well?

        # ========================================================================
        # Step 3: flatten thresholds and compile projects/releases/thresholds by type
        # ========================================================================
        thresholds_by_type: DefaultDict[int, dict[str, list]] = defaultdict()
        for release in queryset:
            # TODO:
            # We should update release model to preserve threshold states.
            # if release.failed_thresholds/passed_thresholds exists - then skip calculating and just return thresholds
            if project_ids_list:
                project_list = release.projects.filter(id__in=project_ids_list)
            else:
                project_list = release.projects.all()
            for project in project_list:
                if environments_list:
                    thresholds_list: List[ReleaseThreshold] = project.release_thresholds.filter(
                        environment__name__in=environments_list
                    )
                else:
                    thresholds_list = project.release_thresholds.all()
                for threshold in thresholds_list:
                    if threshold.threshold_type not in thresholds_by_type:
                        thresholds_by_type[threshold.threshold_type] = {
                            "projects": [],
                            "releases": [],
                            "thresholds": [],
                        }
                    thresholds_by_type[threshold.threshold_type]["projects"].append(project.id)
                    thresholds_by_type[threshold.threshold_type]["releases"].append(release.version)
                    enriched_threshold: EnrichedThreshold = serialize(threshold)
                    enriched_threshold.update(
                        {
                            "key": self.construct_threshold_key(
                                release=release, project=project, threshold=threshold
                            ),
                            "start": release.date,  # deploy.date_finished _would_ be more accurate, but is not keyed on project so cannot be used
                            "end": release.date
                            + timedelta(threshold.window_in_seconds),  # start + threshold.window
                            "release": release.version,
                            "project_id": project.id,
                            "is_healthy": False,
                        }
                    )
                    thresholds_by_type[threshold.threshold_type]["thresholds"].append(
                        enriched_threshold
                    )

        # ========================================================================
        # Step 4: Determine threshold status per threshold type and return results
        # ========================================================================
        release_threshold_health = defaultdict(list)
        for threshold_type, filter_list in thresholds_by_type.items():
            project_id_list = [proj_id for proj_id in filter_list["projects"]]
            release_value_list = [release_version for release_version in filter_list["releases"]]
            category_thresholds: List[EnrichedThreshold] = filter_list["thresholds"]
            if threshold_type == ReleaseThresholdType.TOTAL_ERROR_COUNT:
                """
                Fetch errors timeseries for all projects with an error_count threshold in desired releases
                Iterate through timeseries given threshold window and determine health status

                TODO: If too many results, then throw an error and request user to narrow their search window
                """
                error_counts = get_errors_counts_timeseries_by_project_and_release(
                    end=end,
                    environments_list=environments_list,
                    organization_id=organization.id,
                    project_id_list=project_id_list,
                    release_value_list=release_value_list,
                    start=start,
                )
                for ethreshold in category_thresholds:
                    # TODO: filter by environment as well?
                    is_healthy = is_error_count_healthy(ethreshold, error_counts)
                    ethreshold["is_healthy"] = is_healthy
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.NEW_ISSUE_COUNT:
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.UNHANDLED_ISSUE_COUNT:
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.REGRESSED_ISSUE_COUNT:
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.FAILURE_RATE:
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.CRASH_FREE_SESSION_RATE:
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key
            elif threshold_type == ReleaseThresholdType.CRASH_FREE_USER_RATE:
                for ethreshold in category_thresholds:
                    release_threshold_health[ethreshold["key"]].append(
                        ethreshold
                    )  # so we can fill all thresholds under the same key

        return Response(release_threshold_health, status=200)

    def construct_threshold_key(
        self, project: Project, release: Release, threshold: ReleaseThreshold
    ) -> str:
        """
        Consistent key helps to determine which thresholds can be grouped together.
        project_id - environment - release_version

        NOTE: release versions can contain special characters... `-` delimiter may not be appropriate
        NOTE: environment names can contain special characters... `-` delimiter may not be appropriate
        TODO: move this into a separate helper?
        """
        return f"{project.id}-{threshold.environment.name}-{release.version}"


def is_error_count_healthy(ethreshold: EnrichedThreshold, timeseries: List[Dict[str, Any]]) -> bool:
    """
    Iterate through timeseries given threshold window and determine health status
    enriched threshold (ethreshold) includes `start`, `end`, and a constructed `key` identifier
    """
    total_count = 0
    for i in timeseries:
        if parser.parse(i["time"]) > ethreshold["end"]:
            # timeseries are ordered chronologically
            # So if we're past our threshold.end, we can skip the rest
            break
        if (
            parser.parse(i["time"]) <= ethreshold["start"]  # ts is before our threshold start
            or parser.parse(i["time"]) > ethreshold["end"]  # ts is after our threshold ned
            or i["release"] != ethreshold["release"]  # ts is not our the right release
            or i["project_id"] != ethreshold["project_id"]  # ts is not the right project
            or i["environment"]
            != (
                ethreshold["environment"].name if ethreshold["environment"] else None
            )  # ts is not the right environment
        ):
            continue
        # else ethreshold.start < i.time <= ethreshold.end
        total_count += i["count()"]

    if ethreshold["trigger_type"] == TriggerType.OVER:
        # If total is under/equal the threshold value, then it is healthy
        return total_count <= ethreshold["value"]

    # Else, if total is over/equal the threshold value, then it is healthy
    return total_count >= ethreshold["value"]

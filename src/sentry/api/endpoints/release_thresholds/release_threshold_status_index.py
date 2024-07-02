from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, DefaultDict

from django.db.models import F, Q
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.endpoints.release_thresholds.constants import CRASH_SESSIONS_DISPLAY
from sentry.api.endpoints.release_thresholds.health_checks import (
    is_crash_free_rate_healthy_check,
    is_error_count_healthy,
    is_new_issue_count_healthy,
)
from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.api.endpoints.release_thresholds.utils import (
    fetch_sessions_data,
    get_errors_counts_timeseries_by_project_and_release,
    get_new_issue_counts,
)
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST
from sentry.apidocs.examples.release_threshold_examples import ReleaseThresholdExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.release import Release
from sentry.models.release_threshold.constants import ReleaseThresholdType
from sentry.organizations.services.organization import RpcOrganization
from sentry.utils import metrics

logger = logging.getLogger("sentry.release_threshold_status")

if TYPE_CHECKING:
    from sentry.models.deploy import Deploy
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.release_threshold.release_threshold import ReleaseThreshold
    from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment


class ReleaseThresholdStatusIndexSerializer(serializers.Serializer):
    start = serializers.DateTimeField(
        help_text="The start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. "
        "Use along with `end`.",
        required=True,
    )
    end = serializers.DateTimeField(
        help_text=(
            "The inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. "
            "Use along with `start`."
        ),
        required=True,
    )
    environment = serializers.ListField(
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("A list of environment names to filter your results by."),
    )
    projectSlug = serializers.ListField(
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("A list of project slugs to filter your results by."),
    )
    release = serializers.ListField(
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("A list of release versions to filter your results by."),
    )

    def validate(self, data):
        if data["start"] >= data["end"]:
            raise serializers.ValidationError("Start datetime must be after End")
        return data


@region_silo_endpoint
@extend_schema(tags=["Releases"])
class ReleaseThresholdStatusIndexEndpoint(OrganizationReleasesBaseEndpoint, EnvironmentMixin):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve Statuses of Release Thresholds (Alpha)",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, ReleaseThresholdStatusIndexSerializer],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ReleaseThresholdStatusResponse", dict[str, list[EnrichedThreshold]]
            ),
            400: RESPONSE_BAD_REQUEST,
        },
        examples=ReleaseThresholdExamples.THRESHOLD_STATUS_RESPONSE,
    )
    def get(self, request: Request, organization: Organization | RpcOrganization) -> HttpResponse:
        r"""
        **`[WARNING]`**: This API is an experimental Alpha feature and is subject to change!

        List all derived statuses of releases that fall within the provided start/end datetimes.

        Constructs a response key'd off \{`release_version`\}-\{`project_slug`\} that lists thresholds with their status for *specified* projects.
        Each returned enriched threshold will contain the full serialized `release_threshold` instance as well as it's derived health statuses.
        """
        # TODO: We should limit/paginate results (this could get really bulky)
        # ========================================================================
        # STEP 1: Validate request data
        #
        # NOTE: start/end parameters determine window to query for releases
        # This is NOT the window to query snuba for event data - nor the individual threshold windows
        # ========================================================================
        serializer = ReleaseThresholdStatusIndexSerializer(
            data=request.query_params,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        environments_list = serializer.validated_data.get(
            "environment"
        )  # list of environment names
        project_slug_list = serializer.validated_data.get("projectSlug")
        releases_list = serializer.validated_data.get("release")  # list of release versions
        try:
            filter_params = self.get_filter_params(
                request, organization, date_filter_optional=True, project_slugs=project_slug_list
            )
        except NoProjects:
            raise NoProjects("No projects available")

        start: datetime | None = filter_params["start"]
        end: datetime | None = filter_params["end"]
        logger.info(
            "Checking release status health",
            extra={
                "start": start,
                "end": end,
            },
        )
        metrics.incr("release.threshold_health_status.attempt")

        # ========================================================================
        # Step 2: Fetch releases, prefetch projects & release_thresholds
        # ========================================================================
        release_query = Q(organization=organization, date_added__gte=start, date_added__lte=end)
        if environments_list:
            release_query &= Q(
                releaseprojectenvironment__environment__name__in=environments_list,
            )
        if project_slug_list:
            release_query &= Q(
                projects__slug__in=project_slug_list,
            )
        if releases_list:
            release_query &= Q(
                version__in=releases_list,
            )

        queryset = (
            Release.objects.filter(release_query)
            .annotate(
                date=F("date_added"),  # transforms date_added into 'date'
            )
            .order_by("-date")
            .distinct()
        )
        # prefetching the release_thresholds via the projects model
        queryset.prefetch_related("projects__release_thresholds__environment")
        queryset.prefetch_related("releaseprojectenvironment_set")
        queryset.prefetch_related("deploy_set")

        logger.info(
            "Fetched releases",
            extra={
                "results": len(queryset),
                "project_slugs": project_slug_list,
                "releases": releases_list,
                "environments": environments_list,
            },
        )

        # ========================================================================
        # Step 3: flatten thresholds and compile projects/release-thresholds by type
        # ========================================================================
        thresholds_by_type: DefaultDict[int, dict[str, list]] = defaultdict()
        query_windows_by_type: DefaultDict[int, dict[str, datetime]] = defaultdict()
        for release in queryset:
            # TODO:
            # We should update release model to preserve threshold states.
            # if release.failed_thresholds/passed_thresholds exists - then skip calculating and just return thresholds
            project_list = [
                p
                for p in release.projects.all()
                if (project_slug_list and p.slug in project_slug_list) or (not project_slug_list)
            ]

            for project in project_list:
                thresholds_list: list[ReleaseThreshold] = [
                    t
                    for t in project.release_thresholds.all()
                    if (
                        environments_list
                        and t.environment
                        and t.environment.name in environments_list
                    )
                    or (not environments_list)
                ]

                for threshold in thresholds_list:
                    if threshold.threshold_type not in thresholds_by_type:
                        thresholds_by_type[threshold.threshold_type] = {
                            "project_ids": [],
                            "releases": [],
                            "thresholds": [],
                        }
                    thresholds_by_type[threshold.threshold_type]["project_ids"].append(project.id)
                    thresholds_by_type[threshold.threshold_type]["releases"].append(release.version)
                    if threshold.threshold_type not in query_windows_by_type:
                        query_windows_by_type[threshold.threshold_type] = {
                            "start": datetime.now(tz=timezone.utc),
                            "end": datetime.now(tz=timezone.utc),
                        }

                    latest_deploy: Deploy | None = None
                    if threshold.environment:
                        # NOTE: if a threshold has no environment set, we monitor from start of the release creation
                        # If a deploy does not exist for the thresholds environment, we monitor from start of release creation
                        # ReleaseProjectEnvironment model
                        rpe_entry: ReleaseProjectEnvironment | None = next(
                            (
                                rpe
                                for rpe in release.releaseprojectenvironment_set.all()
                                if rpe.environment == threshold.environment
                                and rpe.project == project
                            ),
                            None,
                        )
                        if rpe_entry:
                            last_deploy_id = rpe_entry.last_deploy_id
                            latest_deploy = next(
                                (
                                    deploy
                                    for deploy in release.deploy_set.all()
                                    if deploy.id == last_deploy_id
                                ),
                                None,
                            )

                    # NOTE: query window starts at the earliest release up until the latest threshold window
                    if latest_deploy:
                        threshold_start = latest_deploy.date_finished
                    else:
                        threshold_start = release.date

                    query_windows_by_type[threshold.threshold_type]["start"] = min(
                        threshold_start, query_windows_by_type[threshold.threshold_type]["start"]
                    )
                    query_windows_by_type[threshold.threshold_type]["end"] = max(
                        threshold_start + timedelta(seconds=threshold.window_in_seconds),
                        query_windows_by_type[threshold.threshold_type]["end"],
                    )
                    # NOTE: enriched threshold is SERIALIZED
                    # meaning project and environment models are dictionaries
                    enriched_threshold: EnrichedThreshold = serialize(threshold)
                    # NOTE: start/end for a threshold are different than start/end for querying data
                    enriched_threshold.update(
                        {
                            "key": self.construct_threshold_key(release=release, project=project),
                            "start": threshold_start,
                            "end": threshold_start
                            + timedelta(
                                seconds=threshold.window_in_seconds
                            ),  # start + threshold.window
                            "release": release.version,
                            "project_slug": project.slug,
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
            project_id_list = [proj_id for proj_id in filter_list["project_ids"]]
            release_value_list = [release_version for release_version in filter_list["releases"]]
            category_thresholds: list[EnrichedThreshold] = filter_list["thresholds"]
            query_window = query_windows_by_type[threshold_type]
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
                """
                Query new issue counts for all projects with a new_issue_count threshold in desired releases
                """
                new_issue_counts = get_new_issue_counts(
                    organization_id=organization.id,
                    thresholds=category_thresholds,
                )
                logger.info(
                    "querying new issue counts",
                    extra={
                        "start": query_window["start"],
                        "end": query_window["end"],
                        "project_ids": project_id_list,
                        "releases": release_value_list,
                        "environments": environments_list,
                        "new_issue_counts_data": new_issue_counts,
                    },
                )
                for ethreshold in category_thresholds:
                    is_healthy, metric_count = is_new_issue_count_healthy(
                        ethreshold, new_issue_counts
                    )
                    ethreshold.update({"is_healthy": is_healthy, "metric_value": metric_count})
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
                query_window = query_windows_by_type[threshold_type]
                sessions_data = {}
                try:
                    sessions_data = fetch_sessions_data(
                        end=query_window["end"],
                        request=request,
                        organization=organization,
                        params=filter_params,
                        start=query_window["start"],
                    )
                except Exception as exc:
                    # TODO: handle InvalidPararms
                    # sentry.exceptions.InvalidParams: Your interval and date range would create too many results. Use a larger interval, or a smaller date range.
                    logger.exception(str(exc))
                logger.info(
                    "fetching sessions data",
                    extra={
                        "start": query_window["start"],
                        "end": query_window["end"],
                        "project_ids": project_id_list,
                        "releases": release_value_list,
                        "environments": environments_list,
                        "error_count_data": error_counts,
                    },
                )
                if sessions_data:
                    for ethreshold in category_thresholds:
                        is_healthy, rate = is_crash_free_rate_healthy_check(
                            ethreshold, sessions_data, CRASH_SESSIONS_DISPLAY
                        )
                        ethreshold.update({"is_healthy": is_healthy, "metric_value": rate})
                        release_threshold_health[ethreshold["key"]].append(ethreshold)
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

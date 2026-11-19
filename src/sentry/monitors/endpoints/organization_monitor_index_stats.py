from __future__ import annotations

from collections import OrderedDict, defaultdict
from collections.abc import MutableMapping
from datetime import UTC, datetime, timedelta
from typing import Annotated, TypedDict, cast

from django.db.models import Count, DateTimeField, Func
from django.db.models.functions import Extract
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.parameters import (
    GlobalParams,
    MonitorParams,
    OrganizationParams,
    StatsRangeParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.monitors.endpoints.base_monitor_stats import validate_bucket_count
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorEnvironment

TRACKED_STATUSES = [
    CheckInStatus.IN_PROGRESS,
    CheckInStatus.OK,
    CheckInStatus.ERROR,
    CheckInStatus.MISSED,
    CheckInStatus.TIMEOUT,
    CheckInStatus.UNKNOWN,
]

MAX_STATS_MONITORS = 20


class MonitorCheckInStatusCounts(TypedDict):
    in_progress: Annotated[int, ApiDescription("Check-ins still in progress")]
    ok: Annotated[int, ApiDescription("Check-ins that succeeded")]
    error: Annotated[int, ApiDescription("Check-ins that failed")]
    missed: Annotated[int, ApiDescription("Check-ins that were expected but never arrived")]
    timeout: Annotated[int, ApiDescription("Check-ins that ran past the maximum runtime")]
    unknown: Annotated[int, ApiDescription("Check-ins whose outcome is unknown")]


# Each bucket is a `[timestamp, counts by environment name]` pair.
MonitorStatsBucket = tuple[int, dict[str, MonitorCheckInStatusCounts]]
OrganizationMonitorIndexStatsResponse = dict[str, list[MonitorStatsBucket]]


def normalize_to_epoch(timestamp: datetime, seconds: int) -> int:
    """
    Given a ``timestamp`` (datetime object) normalize to an epoch timestamp.

    i.e. if the rollup is minutes, the resulting timestamp would have
    the seconds and microseconds rounded down.
    """
    epoch = int(timestamp.timestamp())
    return epoch - (epoch % seconds)


@extend_schema(tags=["Crons"])
@cell_silo_endpoint
class OrganizationMonitorIndexStatsEndpoint(OrganizationEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="listOrganizationMonitorStats",
        summary="Retrieve Check-In Stats for an Organization's Monitors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            MonitorParams.STATS_MONITOR,
            StatsRangeParams.SINCE,
            StatsRangeParams.UNTIL,
            MonitorParams.STATS_RESOLUTION,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationMonitorIndexStatsResponse", OrganizationMonitorIndexStatsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    # TODO(epurkhiser): probably convert to snuba
    def get(
        self, request: Request, organization: Organization
    ) -> Response[OrganizationMonitorIndexStatsResponse]:
        """
        Return check-in counts by status for each requested monitor, in time buckets. The
        response maps each monitor GUID to a list of `[timestamp, counts]` pairs, one for every
        bucket in the range, where `timestamp` is the bucket start as a Unix timestamp and
        `counts` maps each environment name to its counts by status.
        """
        # Do not restrict rollups allowing us to define custom resolutions.
        # Important for this endpoint since we want our buckets to align with
        # the UI's timescale markers.
        args = self._parse_args(request, restrict_rollups=False)

        start = normalize_to_epoch(args["start"], args["rollup"])
        end = normalize_to_epoch(args["end"], args["rollup"])
        validate_bucket_count(start, end, args["rollup"])

        monitor_guids: list[str] = list(dict.fromkeys(request.GET.getlist("monitor")))
        if len(monitor_guids) > MAX_STATS_MONITORS:
            raise ParseError(
                detail=f"Too many monitors requested. Maximum is {MAX_STATS_MONITORS}."
            )

        projects = self.get_projects(request, organization, include_all_accessible=True)
        project_ids = [project.id for project in projects]

        # Pre-fetch the monitor-ids and their guid. This is an
        # optimization to eliminate a join against the monitor table which
        # significantly inflates the size of the aggregation states.
        #
        # The ids are used to explicitly scope the query and the slugs are
        # returned as display data. The slugs have to be fetched (even though
        # we already have them in memory) so we can maintain a correct mapping
        # of id -> slug.
        monitor_map = {
            id: str(guid)
            for id, guid in Monitor.objects.filter(
                organization_id=organization.id, project_id__in=project_ids, guid__in=monitor_guids
            ).values_list("id", "guid")
        }
        # Filter monitors, keeping only ones that the user has access to.
        monitor_guids = [guid for guid in monitor_guids if guid in monitor_map.values()]

        # We only care about the name but we don't want to join to get it. So we're maintaining
        # this map until the very end where we'll map from monitor_environment to environment to
        # name.
        #
        # If no environments were provided we still need to fetch them but we'll do it later in
        # the process when we know which environments need to be fetched.
        environments = get_environments(request, organization)
        environment_map = {env.id: env.name for env in environments}

        # Pre-fetch the monitor environments. This is an optimization to eliminate a join against
        # the monitor-environment table and environment table which significantly inflates the
        # size of the aggregation states.
        #
        # This could return a lot of rows. A better alternative would be to denormalize the
        # environment name onto the check-in table.
        monitor_environment_query = MonitorEnvironment.objects.filter(
            monitor_id__in=monitor_map.keys()
        )
        if environment_map:
            monitor_environment_query = monitor_environment_query.filter(
                environment_id__in=environment_map.keys()
            )

        monitor_environment_rows = list(
            monitor_environment_query.values_list("id", "monitor_id", "environment_id")
        )
        monitor_environment_map = {
            monitor_environment_id: environment_id
            for monitor_environment_id, _monitor_id, environment_id in monitor_environment_rows
        }
        monitor_environment_to_monitor_id = {
            monitor_environment_id: monitor_id
            for monitor_environment_id, monitor_id, _environment_id in monitor_environment_rows
        }

        # If the monitor_environment_map was fetched without the help of the environments
        # parameter, we need to populate the environment_map with all the environment_ids found
        # in the set.
        if not environment_map:
            # Since monitor-environments can have null environment-ids we need to verify that a
            # valid environment-id exists in the set before querying.
            #
            # Otherwise we can skip this and default to the "production" environment label.
            eids = list(filter(lambda eid: eid is not None, monitor_environment_map.values()))
            if eids:
                environments = list(Environment.objects.filter(id__in=eids))
                environment_map = {env.id: env.name for env in environments}

        # MonitorEnvironment already carries monitor_id, so keep monitor_id out of the
        # aggregate and let the monitor_environment/date/status index cover the query.
        check_ins = MonitorCheckIn.objects.filter(
            monitor_environment_id__in=monitor_environment_map.keys(),
            date_added__gte=args["start"],
            date_added__lt=args["end"],
        )
        group_by = ("bucket", "monitor_environment_id", "status")

        # Use postgres' `date_bin` to bucket rounded to our rollups
        bucket = Func(
            timedelta(seconds=args["rollup"]),
            "date_added",
            datetime.fromtimestamp(start, UTC),
            function="date_bin",
            output_field=DateTimeField(),
        )
        # Save space on date allocation and return buckets as unix timestamps
        bucket = Extract(bucket, "epoch")

        # retrieve the list of checkins in the time range and count each by
        # status. Bucketing is done at the postgres level for performance
        history = (
            check_ins.annotate(bucket=bucket)
            .values(*group_by)
            .annotate(count=Count("*"))
            .values_list(*group_by, "count")
        )

        status_to_name = dict(CheckInStatus.as_choices())

        StatusStats = MutableMapping[str, int]

        def status_obj_factory() -> StatusStats:
            return {status_to_name[status]: 0 for status in TRACKED_STATUSES}

        # Mapping chain of monitor_id -> timestamp[] -> monitor_env_names -> StatusStats
        EnvToStatusMapping = MutableMapping[int, StatusStats]
        TsToEnvsMapping = MutableMapping[int, EnvToStatusMapping]
        MonitorToTimestampsMapping = MutableMapping[str, TsToEnvsMapping]

        # Use ordered dict for timestamp -> envs mapping since we want to
        # maintain the ordering of the timestamps
        stats: MonitorToTimestampsMapping = defaultdict(OrderedDict)

        # initialize mappings
        for guid in monitor_guids:
            ts = start
            while ts <= end:
                stats[guid][ts] = defaultdict(status_obj_factory)
                ts += args["rollup"]

        # We manually sort the response output by guid and bucket. This is fine because the set
        # of keys is known (they're provided as a query parameter) and there is no pagination.
        def sort_history_key(row: tuple[int, int, object, int]) -> tuple[str, int]:
            ts, meid, _status, _count = row
            return monitor_map[monitor_environment_to_monitor_id[meid]], ts

        # Every check-in has a monitor environment, so there is nothing to
        # count without one.
        rows = sorted(history, key=sort_history_key) if monitor_environment_map else []
        for ts, meid, status, count in rows:
            guid = monitor_map[monitor_environment_to_monitor_id[meid]]

            # Monitor environments can be null.  If we find a null monitor environment we
            # default to "production" by convention.
            if meid not in monitor_environment_map:
                env_name = "production"
            else:
                env_name = environment_map[monitor_environment_map[meid]]

            named_status = status_to_name[status]
            stats[guid][ts][env_name][named_status] = count  # type: ignore[index]

        # Flatten the timestamp to env mapping dict into a tuple list, this
        # maintains the ordering
        stats_list = {
            guid: [[ts, env_mapping] for ts, env_mapping in ts_to_envs.items()]
            for guid, ts_to_envs in stats.items()
        }

        # Each `[timestamp, env_mapping]` list serializes as the documented pair.
        return Response(cast(OrganizationMonitorIndexStatsResponse, stats_list))

from __future__ import annotations

from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta
from typing import List, MutableMapping

from django.db.models import Count, DateTimeField, Func
from django.db.models.functions import Extract
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.models.environment import Environment
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorEnvironment
from sentry.utils.dates import to_timestamp


def normalize_to_epoch(timestamp: datetime, seconds: int):
    """
    Given a ``timestamp`` (datetime object) normalize to an epoch timestamp.

    i.e. if the rollup is minutes, the resulting timestamp would have
    the seconds and microseconds rounded down.
    """
    epoch = int(to_timestamp(timestamp))
    return epoch - (epoch % seconds)


@region_silo_endpoint
class OrganizationMonitorIndexStatsEndpoint(OrganizationEndpoint, StatsMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    # TODO(epurkhiser): probably convert to snuba
    def get(self, request: Request, organization) -> Response:
        # Do not restrict rollups allowing us to define custom resolutions.
        # Important for this endpoint since we want our buckets to align with
        # the UI's timescale markers.
        args = self._parse_args(request, restrict_rollups=False)

        start = normalize_to_epoch(args["start"], args["rollup"])
        end = normalize_to_epoch(args["end"], args["rollup"])

        monitor_slugs: List[str] = request.GET.getlist("monitor")

        tracked_statuses = [
            CheckInStatus.IN_PROGRESS,
            CheckInStatus.OK,
            CheckInStatus.ERROR,
            CheckInStatus.MISSED,
            CheckInStatus.TIMEOUT,
        ]

        # Pre-fetch the monitor-ids and their slugs. This is an optimization to eliminate a join
        # against the monitor table which significantly inflates the size of the aggregation
        # states.
        #
        # The ids are used to explicitly scope the query and the slugs are returned as display
        # data. The slugs have to be fetched (even though we already have them in memory) so we
        # can maintain a correct mapping of id -> slug.
        monitor_map = dict(
            Monitor.objects.filter(
                organization_id=organization.id, slug__in=monitor_slugs
            ).values_list("id", "slug")
        )

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

        monitor_environment_map = dict(
            monitor_environment_query.values_list("id", "environment_id")
        )

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
                environments = Environment.objects.filter(id__in=eids)
                environment_map = {env.id: env.name for env in environments}

        check_ins = MonitorCheckIn.objects.filter(
            monitor_id__in=monitor_map.keys(),
            status__in=tracked_statuses,
            date_added__gt=args["start"],
            date_added__lte=args["end"],
        )

        if monitor_environment_map:
            check_ins = check_ins.filter(monitor_environment_id__in=monitor_environment_map.keys())

        # Use postgres' `date_bin` to bucket rounded to our rollups
        bucket = Func(
            timedelta(seconds=args["rollup"]),
            "date_added",
            datetime.fromtimestamp(start),
            function="date_bin",
            output_field=DateTimeField(),
        )
        # Save space on date allocation and return buckets as unix timestamps
        bucket = Extract(bucket, "epoch")

        # retrieve the list of checkins in the time range and count each by
        # status. Bucketing is done at the postgres level for performance
        history = (
            check_ins.all()
            .annotate(bucket=bucket)
            .values(
                "bucket",
                "monitor_id",
                "monitor_environment_id",
                "status",
            )
            .annotate(count=Count("*"))
            .values_list(
                "monitor_id",
                "bucket",
                "monitor_environment_id",
                "status",
                "count",
            )
        )

        status_to_name = dict(CheckInStatus.as_choices())

        StatusStats = MutableMapping[str, int]

        def status_obj_factory() -> StatusStats:
            return {status_to_name[status]: 0 for status in tracked_statuses}

        # Mapping chain of monitor_id -> timestamp[] -> monitor_env_names -> StatusStats
        EnvToStatusMapping = MutableMapping[int, StatusStats]
        TsToEnvsMapping = MutableMapping[int, EnvToStatusMapping]
        MonitorToTimestampsMapping = MutableMapping[str, TsToEnvsMapping]

        # Use ordered dict for timestamp -> envs mapping since we want to
        # maintain the ordering of the timestamps
        stats: MonitorToTimestampsMapping = defaultdict(OrderedDict)

        # initialize mappings
        for slug in monitor_slugs:
            ts = start
            while ts <= end:
                stats[slug][ts] = defaultdict(status_obj_factory)
                ts += args["rollup"]

        # We manually sort the response output by slug and bucket. This is fine because the set
        # of slugs is known (they're provided as a query parameter) and there is no pagination.
        for mid, ts, meid, status, count in sorted(
            list(history), key=lambda k: (monitor_map[k[0]], k[1])
        ):
            slug = monitor_map[mid]

            # Monitor environments can be null.  If we find a null monitor environment we
            # default to "production" by convention.
            if meid not in monitor_environment_map:
                env_name = "production"
            else:
                env_name = environment_map[monitor_environment_map[meid]]

            named_status = status_to_name[status]
            stats[slug][ts][env_name][named_status] = count  # type: ignore

        # Flatten the timestamp to env mapping dict into a tuple list, this
        # maintains the ordering
        stats_list = {
            slug: [[ts, env_mapping] for ts, env_mapping in ts_to_envs.items()]
            for slug, ts_to_envs in stats.items()
        }

        return Response(stats_list)

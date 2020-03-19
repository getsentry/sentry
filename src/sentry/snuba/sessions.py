from __future__ import absolute_import

import pytz
from datetime import datetime, timedelta

from sentry.utils.snuba import raw_query, parse_snuba_datetime
from sentry.utils.dates import to_timestamp
from sentry.snuba.dataset import Dataset


def _convert_duration(val):
    if val != val:
        return None
    return val / 1000.0


def _get_conditions_and_filter_keys(project_releases, environments):
    conditions = [["release", "IN", list(x[1] for x in project_releases)]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])
    filter_keys = {"project_id": list(set(x[0] for x in project_releases))}
    return conditions, filter_keys


def get_changed_project_release_model_adoptions(project_ids):
    """Returns the last 48 hours worth of releases."""
    start = datetime.now(pytz.utc) - timedelta(days=2)
    rv = []

    # Find all releases with adoption in the last 24 hours
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["project_id", "release", "users"],
        groupby=["release", "project_id"],
        start=start,
        filter_keys={"project_id": project_ids},
    )["data"]:
        rv.append((x["project_id"], x["release"]))

    return rv


def check_has_health_data(project_releases):
    conditions = [["release", "IN", list(x[1] for x in project_releases)]]
    filter_keys = {"project_id": list(set(x[0] for x in project_releases))}
    return set(
        (x["project_id"], x["release"])
        for x in raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["release", "project_id"],
            groupby=["release", "project_id"],
            start=datetime.utcnow() - timedelta(days=90),
            conditions=conditions,
            filter_keys=filter_keys,
        )["data"]
    )


def get_project_releases_by_stability(
    project_ids, offset, limit, scope, stats_period=None, environments=None
):
    """Given some project IDs returns adoption rates that should be updated
    on the postgres tables.
    """
    if stats_period is None:
        stats_period = "24h"

    _, stats_start, _ = get_rollup_starts_and_buckets(stats_period)

    orderby = {
        "crash_free_sessions": [["divide", ["sessions_crashed", "sessions"]]],
        "crash_free_users": [["divide", ["users_crashed", "users"]]],
        "sessions": ["sessions"],
        "users": ["users"],
    }[scope]

    conditions = []
    if environments is not None:
        conditions.append(["environment", "IN", environments])
    filter_keys = {"project_id": project_ids}
    rv = []

    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["project_id", "release"],
        groupby=["release", "project_id"],
        orderby=orderby,
        start=stats_start,
        offset=offset,
        limit=limit,
        conditions=conditions,
        filter_keys=filter_keys,
    )["data"]:
        rv.append((x["project_id"], x["release"]))

    return rv


def _make_stats(start, rollup, buckets, default=0):
    rv = []
    start = int(to_timestamp(start) // rollup) * rollup
    for x in range(buckets):
        rv.append([start, default])
        start += rollup
    return rv


STATS_PERIODS = {
    "1h": (3600, 1),
    "24h": (3600, 24),
    "1d": (3600, 24),
    "48h": (3600, 48),
    "2d": (3600, 48),
    "7d": (86400, 7),
    "14d": (86400, 14),
    "30d": (86400, 30),
    "90d": (259200, 30),
}


def get_rollup_starts_and_buckets(period):
    if period is None:
        return None, None, None
    if period not in STATS_PERIODS:
        raise TypeError("Invalid stats period")
    seconds, buckets = STATS_PERIODS[period]
    start = datetime.now(pytz.utc) - timedelta(seconds=seconds * buckets)
    return seconds, start, buckets


def get_release_health_data_overview(
    project_releases, environments=None, summary_stats_period=None, health_stats_period=None
):
    """Checks quickly for which of the given project releases we have
    health data available.  The argument is a tuple of `(project_id, release_name)`
    tuples.  The return value is a set of all the project releases that have health
    data.
    """

    _, summary_start, _ = get_rollup_starts_and_buckets(summary_stats_period or "24h")
    conditions, filter_keys = _get_conditions_and_filter_keys(project_releases, environments)

    stats_rollup, stats_start, stats_buckets = get_rollup_starts_and_buckets(health_stats_period)

    total_users = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["release", "users"],
        groupby=["release", "project_id"],
        start=summary_start,
        conditions=conditions,
        filter_keys=filter_keys,
    )["data"]:
        total_users[x["project_id"]] = x["users"]

    missing_releases = set(project_releases)
    rv = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "release",
            "project_id",
            "duration_quantiles",
            "users",
            "sessions",
            "sessions_errored",
            "sessions_crashed",
            "users_crashed",
        ],
        groupby=["release", "project_id"],
        start=summary_start,
        conditions=conditions,
        filter_keys=filter_keys,
    )["data"]:
        x_total_users = total_users.get(x["project_id"])
        rp = {
            "duration_p50": _convert_duration(x["duration_quantiles"][0]),
            "duration_p90": _convert_duration(x["duration_quantiles"][1]),
            "crash_free_users": (
                100 - x["users_crashed"] / float(x["users"]) * 100 if x["users"] else None
            ),
            "crash_free_sessions": (
                100 - x["sessions_crashed"] / float(x["sessions"]) * 100 if x["sessions"] else None
            ),
            "total_users": x["users"],
            "total_sessions": x["sessions"],
            "sessions_crashed": x["sessions_crashed"],
            "sessions_errored": x["sessions_errored"],
            "adoption": x["users"] / x_total_users * 100 if x_total_users and x["users"] else None,
            "has_health_data": True,
        }
        if health_stats_period:
            rp["stats"] = {
                health_stats_period: _make_stats(stats_start, stats_rollup, stats_buckets)
            }
        rv[x["project_id"], x["release"]] = rp
        missing_releases.discard((x["project_id"], x["release"]))

    # Add releases without data points
    if missing_releases:
        # If we're already looking at a 90 day horizont we don't need to
        # fire another query, we can already assume there is no data.
        if summary_stats_period != "90d":
            has_health_data = check_has_health_data(missing_releases)
        else:
            has_health_data = ()
        for key in missing_releases:
            rv[key] = {
                "duration_p50": None,
                "duration_p90": None,
                "crash_free_users": None,
                "crash_free_sessions": None,
                "total_users": 0,
                "total_sessions": 0,
                "sessions_crashed": 0,
                "sessions_errored": 0,
                "adoption": None,
                "has_health_data": key in has_health_data,
            }
            if health_stats_period:
                rv[key]["stats"] = {
                    health_stats_period: _make_stats(stats_start, stats_rollup, stats_buckets)
                }

    if health_stats_period:
        for x in raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["release", "project_id", "bucketed_started", "sessions"],
            groupby=["release", "project_id", "bucketed_started"],
            rollup=stats_rollup,
            start=stats_start,
            conditions=conditions,
            filter_keys=filter_keys,
        )["data"]:
            time_bucket = int(
                (parse_snuba_datetime(x["bucketed_started"]) - stats_start).total_seconds()
                / stats_rollup
            )
            rv[x["project_id"], x["release"]]["stats"][health_stats_period][time_bucket][1] = x[
                "sessions"
            ]

    return rv


def get_crash_free_breakdown(project_id, release, environments=None):
    filter_keys = {"project_id": [project_id]}
    conditions = [["release", "=", release]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])

    def _query_stats(start_delta):
        row = raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["users", "users_crashed", "sessions", "sessions_crashed"],
            start=datetime.now(pytz.utc) - start_delta,
            conditions=conditions,
            filter_keys=filter_keys,
        )["data"][0]
        return {
            "total_users": row["users"],
            "crash_free_users": row["users_crashed"] / float(row["users"]) * 100
            if row["users"]
            else None,
            "total_sessions": row["sessions"],
            "crash_free_sessions": row["sessions_crashed"] / float(row["sessions"]) * 100
            if row["sessions"]
            else None,
        }

    return {
        "1d": _query_stats(timedelta(days=1)),
        "1w": _query_stats(timedelta(days=7)),
        "2w": _query_stats(timedelta(days=14)),
        "4w": _query_stats(timedelta(days=28)),
    }


def get_project_release_stats(project_id, release, stat, rollup, start, end, environments=None):
    assert stat in ("users", "sessions")

    filter_keys = {"project_id": [project_id]}
    conditions = [["release", "=", release]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])

    buckets = int((end - start).total_seconds() / rollup)
    stats = _make_stats(start, rollup, buckets, default=None)

    for rv in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "bucketed_started",
            "release",
            stat,
            stat + "_crashed",
            stat + "_abnormal",
            stat + "_errored",
            "duration_quantiles",
        ],
        groupby=["bucketed_started", "release", "project_id"],
        start=start,
        end=end,
        rollup=rollup,
        conditions=conditions,
        filter_keys=filter_keys,
    )["data"]:
        ts = parse_snuba_datetime(rv["bucketed_started"])
        bucket = int((end - ts).total_seconds() / rollup)
        stats[bucket][1] = {
            stat: rv[stat],
            stat + "_crashed": rv[stat + "_crashed"],
            stat + "_abnormal": rv[stat + "_abnormal"],
            stat + "_errored": rv[stat + "_errored"] - rv[stat + "_crashed"],
            "duration_p50": _convert_duration(rv["duration_quantiles"][0]),
            "duration_p90": _convert_duration(rv["duration_quantiles"][1]),
        }

    for idx, bucket in enumerate(stats):
        if bucket[1] is None:
            stats[idx][1] = {
                stat: 0,
                stat + "_crashed": 0,
                stat + "_abnormal": 0,
                stat + "_errored": 0,
                "duration_p50": None,
                "duration_p90": None,
            }

    return stats

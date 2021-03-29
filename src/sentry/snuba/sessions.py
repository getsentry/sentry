import pytz
from datetime import datetime, timedelta

from sentry.utils.snuba import raw_query, parse_snuba_datetime, QueryOutsideRetentionError
from sentry.utils.dates import to_timestamp, to_datetime
from sentry.snuba.dataset import Dataset


DATASET_BUCKET = 3600


def _convert_duration(val):
    if val != val:
        return None
    return val / 1000.0


def _get_conditions_and_filter_keys(project_releases, environments):
    conditions = [["release", "IN", list(x[1] for x in project_releases)]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])
    filter_keys = {"project_id": list({x[0] for x in project_releases})}
    return conditions, filter_keys


def get_changed_project_release_model_adoptions(project_ids):
    """Returns the last 72 hours worth of releases."""
    start = datetime.now(pytz.utc) - timedelta(days=3)
    rv = []

    # Find all releases with adoption in the last 48 hours
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["project_id", "release", "users"],
        groupby=["release", "project_id"],
        start=start,
        referrer="sessions.get-adoption",
        filter_keys={"project_id": list(project_ids)},
    )["data"]:
        rv.append((x["project_id"], x["release"]))

    return rv


def get_oldest_health_data_for_releases(project_releases):
    """Returns the oldest health data we have observed in a release
    in 90 days.  This is used for backfilling.
    """
    conditions = [["release", "IN", [x[1] for x in project_releases]]]
    filter_keys = {"project_id": [x[0] for x in project_releases]}
    rows = raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[["min", ["started"], "oldest"], "project_id", "release"],
        groupby=["release", "project_id"],
        start=datetime.utcnow() - timedelta(days=90),
        conditions=conditions,
        referrer="sessions.oldest-data-backfill",
        filter_keys=filter_keys,
    )["data"]
    rv = {}
    for row in rows:
        rv[row["project_id"], row["release"]] = row["oldest"]
    return rv


def check_has_health_data(project_releases):
    conditions = [["release", "IN", list(x[1] for x in project_releases)]]
    filter_keys = {"project_id": list({x[0] for x in project_releases})}
    return {
        (x["project_id"], x["release"])
        for x in raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["release", "project_id"],
            groupby=["release", "project_id"],
            start=datetime.utcnow() - timedelta(days=90),
            conditions=conditions,
            referrer="sessions.health-data-check",
            filter_keys=filter_keys,
        )["data"]
    }


def get_project_releases_by_stability(
    project_ids, offset, limit, scope, stats_period=None, environments=None
):
    """Given some project IDs returns adoption rates that should be updated
    on the postgres tables.
    """
    if stats_period is None:
        stats_period = "24h"

    # Special rule that we support sorting by the last 24h only.
    if scope.endswith("_24h"):
        scope = scope[:-4]
        stats_period = "24h"

    _, stats_start, _ = get_rollup_starts_and_buckets(stats_period)

    orderby = {
        "crash_free_sessions": [["divide", ["sessions_crashed", "sessions"]]],
        "crash_free_users": [["divide", ["users_crashed", "users"]]],
        "sessions": ["-sessions"],
        "users": ["-users"],
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
        referrer="sessions.stability-sort",
    )["data"]:
        rv.append((x["project_id"], x["release"]))

    return rv


def _make_stats(start, rollup, buckets, default=0):
    rv = []
    start = int(to_timestamp(start) // rollup + 1) * rollup
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


def get_release_adoption(project_releases, environments=None, now=None):
    """Get the adoption of the last 24 hours (or a difference reference timestamp)."""
    conditions, filter_keys = _get_conditions_and_filter_keys(project_releases, environments)
    if now is None:
        now = datetime.now(pytz.utc)
    start = now - timedelta(days=1)

    total_conditions = []
    if environments is not None:
        total_conditions.append(["environment", "IN", environments])

    # Users Adoption
    total_users = {}
    # Session Adoption
    total_sessions = {}

    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["project_id", "users", "sessions"],
        groupby=["project_id"],
        start=start,
        conditions=total_conditions,
        filter_keys=filter_keys,
        referrer="sessions.release-adoption-total-users-and-sessions",
    )["data"]:
        total_users[x["project_id"]] = x["users"]
        total_sessions[x["project_id"]] = x["sessions"]

    rv = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["release", "project_id", "users", "sessions"],
        groupby=["release", "project_id"],
        start=start,
        conditions=conditions,
        filter_keys=filter_keys,
        referrer="sessions.release-adoption-list",
    )["data"]:
        # Users Adoption
        total_users_count = total_users.get(x["project_id"])

        users_adoption = None
        if total_users_count:
            users_adoption = float(x["users"]) / total_users_count * 100

        # Sessions Adoption
        total_sessions_count = total_sessions.get(x["project_id"])

        sessions_adoption = None
        if total_sessions_count:
            sessions_adoption = float(x["sessions"] / total_sessions_count * 100)

        rv[x["project_id"], x["release"]] = {
            "adoption": users_adoption,
            "sessions_adoption": sessions_adoption,
            "users_24h": x["users"],
            "sessions_24h": x["sessions"],
            "project_users_24h": total_users_count,
            "project_sessions_24h": total_sessions_count,
        }

    return rv


def extract_duration_quantiles(raw_stats):
    if len(raw_stats["duration_quantiles"]) == 2:
        return {
            "duration_p50": _convert_duration(raw_stats["duration_quantiles"][0]),
            "duration_p90": _convert_duration(raw_stats["duration_quantiles"][1]),
        }

    else:
        return {
            "duration_p50": _convert_duration(raw_stats["duration_quantiles"][0]),
            "duration_p90": _convert_duration(raw_stats["duration_quantiles"][2]),
        }


def get_release_health_data_overview(
    project_releases,
    environments=None,
    summary_stats_period=None,
    health_stats_period=None,
    stat=None,
):
    """Checks quickly for which of the given project releases we have
    health data available.  The argument is a tuple of `(project_id, release_name)`
    tuples.  The return value is a set of all the project releases that have health
    data.
    """
    if stat is None:
        stat = "sessions"
    assert stat in ("sessions", "users")

    _, summary_start, _ = get_rollup_starts_and_buckets(summary_stats_period or "24h")
    conditions, filter_keys = _get_conditions_and_filter_keys(project_releases, environments)

    stats_rollup, stats_start, stats_buckets = get_rollup_starts_and_buckets(health_stats_period)

    missing_releases = set(project_releases)
    rv = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "release",
            "project_id",
            "duration_quantiles",
            "sessions",
            "sessions_errored",
            "sessions_crashed",
            "sessions_abnormal",
            "users",
            "users_crashed",
        ],
        groupby=["release", "project_id"],
        start=summary_start,
        conditions=conditions,
        filter_keys=filter_keys,
        referrer="sessions.release-overview",
    )["data"]:
        rp = {
            "crash_free_users": (
                100 - x["users_crashed"] / float(x["users"]) * 100 if x["users"] else None
            ),
            "crash_free_sessions": (
                100 - x["sessions_crashed"] / float(x["sessions"]) * 100 if x["sessions"] else None
            ),
            "total_users": x["users"],
            "total_sessions": x["sessions"],
            "sessions_crashed": x["sessions_crashed"],
            "sessions_errored": max(
                0, x["sessions_errored"] - x["sessions_crashed"] - x["sessions_abnormal"]
            ),
            "has_health_data": True,
        }
        rp.update(extract_duration_quantiles(x))
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
                "has_health_data": key in has_health_data,
            }
            if health_stats_period:
                rv[key]["stats"] = {
                    health_stats_period: _make_stats(stats_start, stats_rollup, stats_buckets)
                }

    # Fill in release adoption
    release_adoption = get_release_adoption(project_releases, environments)
    for key in rv:
        adoption_info = release_adoption.get(key) or {}
        rv[key]["adoption"] = adoption_info.get("adoption")
        rv[key]["sessions_adoption"] = adoption_info.get("sessions_adoption")
        rv[key]["total_users_24h"] = adoption_info.get("users_24h")
        rv[key]["total_project_users_24h"] = adoption_info.get("project_users_24h")
        rv[key]["total_sessions_24h"] = adoption_info.get("sessions_24h")
        rv[key]["total_project_sessions_24h"] = adoption_info.get("project_sessions_24h")

    if health_stats_period:
        for x in raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["release", "project_id", "bucketed_started", stat],
            groupby=["release", "project_id", "bucketed_started"],
            rollup=stats_rollup,
            start=stats_start,
            conditions=conditions,
            filter_keys=filter_keys,
            referrer="sessions.release-stats",
        )["data"]:
            time_bucket = int(
                (parse_snuba_datetime(x["bucketed_started"]) - stats_start).total_seconds()
                / stats_rollup
            )
            key = (x["project_id"], x["release"])
            # Sometimes this might return a release we haven't seen yet or it might
            # return a time bucket that did not exist yet at the time of the initial
            # query.  In that case, just skip it.
            if key in rv and time_bucket < len(rv[key]["stats"][health_stats_period]):
                rv[key]["stats"][health_stats_period][time_bucket][1] = x[stat]

    return rv


def get_crash_free_breakdown(project_id, release, start, environments=None):
    filter_keys = {"project_id": [project_id]}
    conditions = [["release", "=", release]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])

    now = datetime.now(pytz.utc)

    def _query_stats(end):
        row = raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["users", "users_crashed", "sessions", "sessions_crashed"],
            end=end,
            start=start,
            conditions=conditions,
            filter_keys=filter_keys,
            referrer="sessions.crash-free-breakdown",
        )["data"][0]
        return {
            "date": end,
            "total_users": row["users"],
            "crash_free_users": 100 - row["users_crashed"] / float(row["users"]) * 100
            if row["users"]
            else None,
            "total_sessions": row["sessions"],
            "crash_free_sessions": 100 - row["sessions_crashed"] / float(row["sessions"]) * 100
            if row["sessions"]
            else None,
        }

    last = None
    rv = []
    for offset in (
        timedelta(days=1),
        timedelta(days=2),
        timedelta(days=7),
        timedelta(days=14),
        timedelta(days=30),
    ):
        try:
            item_start = start + offset
            if item_start > now:
                if last is None or (item_start - last).days > 1:
                    rv.append(_query_stats(now))
                break
            rv.append(_query_stats(item_start))
            last = item_start
        except QueryOutsideRetentionError:
            # cannot query for these
            pass

    return rv


def get_project_release_stats(project_id, release, stat, rollup, start, end, environments=None):
    assert stat in ("users", "sessions")

    # since snuba end queries are exclusive of the time and we're bucketing to
    # a full hour, we need to round to the next hour since snuba is exclusive
    # on the end.
    end = to_datetime((to_timestamp(end) // DATASET_BUCKET + 1) * DATASET_BUCKET)

    filter_keys = {"project_id": [project_id]}
    conditions = [["release", "=", release]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])

    buckets = int((end - start).total_seconds() / rollup)
    stats = _make_stats(start, rollup, buckets, default=None)

    # Due to the nature of the probabilistic data structures some
    # subtractions can become negative.  As such we're making sure a number
    # never goes below zero to avoid confusion.

    totals = {
        stat: 0,
        stat + "_healthy": 0,
        stat + "_crashed": 0,
        stat + "_abnormal": 0,
        stat + "_errored": 0,
    }

    for rv in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "bucketed_started",
            stat,
            stat + "_crashed",
            stat + "_abnormal",
            stat + "_errored",
            "duration_quantiles",
        ],
        groupby=["bucketed_started"],
        start=start,
        end=end,
        rollup=rollup,
        conditions=conditions,
        filter_keys=filter_keys,
        referrer="sessions.release-stats-details",
    )["data"]:
        ts = parse_snuba_datetime(rv["bucketed_started"])
        bucket = int((ts - start).total_seconds() / rollup)
        stats[bucket][1] = {
            stat: rv[stat],
            stat + "_healthy": max(0, rv[stat] - rv[stat + "_errored"]),
            stat + "_crashed": rv[stat + "_crashed"],
            stat + "_abnormal": rv[stat + "_abnormal"],
            stat
            + "_errored": max(
                0, rv[stat + "_errored"] - rv[stat + "_crashed"] - rv[stat + "_abnormal"]
            ),
        }
        stats[bucket][1].update(extract_duration_quantiles(rv))

        # Session stats we can sum up directly without another query
        # as the data becomes available.
        if stat == "sessions":
            for k in totals:
                totals[k] += stats[bucket][1][k]

    for idx, bucket in enumerate(stats):
        if bucket[1] is None:
            stats[idx][1] = {
                stat: 0,
                stat + "_healthy": 0,
                stat + "_crashed": 0,
                stat + "_abnormal": 0,
                stat + "_errored": 0,
                "duration_p50": None,
                "duration_p90": None,
            }

    # For users we need a secondary query over the entire time range
    if stat == "users":
        rows = raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["users", "users_crashed", "users_abnormal", "users_errored"],
            start=start,
            end=end,
            conditions=conditions,
            filter_keys=filter_keys,
            referrer="sessions.crash-free-breakdown-users",
        )["data"]
        if rows:
            rv = rows[0]
            totals = {
                "users": rv["users"],
                "users_healthy": max(0, rv["users"] - rv["users_errored"]),
                "users_crashed": rv["users_crashed"],
                "users_abnormal": rv["users_abnormal"],
                "users_errored": max(
                    0, rv["users_errored"] - rv["users_crashed"] - rv["users_abnormal"]
                ),
            }

    return stats, totals


def get_release_sessions_time_bounds(project_id, release, org_id, environments=None):
    """
    Get the sessions time bounds in terms of when the first session started and
    when the last session started according to a specific (project_id, org_id, release, environments)
    combination
    Inputs:
        * project_id
        * release
        * org_id: Organisation Id
        * environments
    Return:
        Dictionary with two keys "sessions_lower_bound" and "sessions_upper_bound" that
    correspond to when the first session occurred and when the last session occurred respectively
    """
    release_sessions_time_bounds = {
        "sessions_lower_bound": None,
        "sessions_upper_bound": None,
    }

    filter_keys = {"project_id": [project_id], "org_id": [org_id]}
    conditions = [["release", "=", release]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])

    rows = raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["first_session_started", "last_session_started"],
        aggregations=[
            ["min(started)", None, "first_session_started"],
            ["max(started)", None, "last_session_started"],
        ],
        conditions=conditions,
        filter_keys=filter_keys,
        referrer="sessions.release-sessions-time-bounds",
    )["data"]

    formatted_unix_start_time = datetime.utcfromtimestamp(0).strftime("%Y-%m-%dT%H:%M:%S+00:00")

    if rows:
        rv = rows[0]

        # This check is added because if there are no sessions found, then the
        # aggregations query return both the sessions_lower_bound and the
        # sessions_upper_bound as `0` timestamp and we do not want that behaviour
        # by default
        # P.S. To avoid confusion the `0` timestamp which is '1970-01-01 00:00:00'
        # is rendered as '0000-00-00 00:00:00' in clickhouse shell
        if set(rv.values()) != {formatted_unix_start_time}:
            release_sessions_time_bounds = {
                "sessions_lower_bound": rv["first_session_started"],
                "sessions_upper_bound": rv["last_session_started"],
            }
    return release_sessions_time_bounds

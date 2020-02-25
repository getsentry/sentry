from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.utils.snuba import raw_query, parse_snuba_datetime
from sentry.snuba.dataset import Dataset


def _get_conditions(project_releases, environments):
    conditions = [["release", "IN", list(x[1] for x in project_releases)]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])
    return conditions


def check_releases_for_health_data(project_releases, environments=None):
    """Checks quickly for which of the given project releases we have
    health data available.  The argument is a tuple of `(project_id, release_name)`
    tuples.  The return value is a set of all the project releases that have health
    data.
    """
    return set(
        (x["project_id"], x["release"])
        for x in raw_query(
            dataset=Dataset.Sessions,
            selected_columns=["release", "project_id"],
            groupby=["release", "project_id"],
            conditions=_get_conditions(project_releases, environments),
            filter_keys={"project_id": list(x[0] for x in project_releases)},
        )["data"]
    )


def get_release_health_data_overview(project_releases, environments=None):
    """Checks quickly for which of the given project releases we have
    health data available.  The argument is a tuple of `(project_id, release_name)`
    tuples.  The return value is a set of all the project releases that have health
    data.
    """

    def _nan_as_none(val):
        return None if val != val else val

    yesterday = datetime.utcnow() - timedelta(days=1)

    rv = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "release",
            "project_id",
            "duration",
            "uniq_users",
            "uniq_sessions",
            "uniq_sessions_crashed",
            "uniq_users_crashed",
        ],
        groupby=["release", "project_id", "started"],
        rollup=24 * 60 * 60,
        conditions=_get_conditions(project_releases, environments),
        filter_keys={"project_id": list(x[0] for x in project_releases)},
    )["data"]:
        rv[x["project_id"], x["release"]] = {
            "duration_p50": _nan_as_none(x["duration"][0]),
            "duration_p90": _nan_as_none(x["duration"][1]),
            "crash_free_users": (
                100 - x["uniq_users_crashed"] / float(x["uniq_users"]) * 100
                if x["uniq_users"]
                else None
            ),
            "crash_free_sessions": (
                100 - x["uniq_sessions_crashed"] / float(x["uniq_sessions"]) * 100
                if x["uniq_sessions"]
                else None
            ),
            "total_users": x["uniq_users"],
            "total_sessions": x["uniq_sessions"],
            "stats": {"24h": [0] * 24},
        }

    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["release", "project_id", "started", "uniq_sessions"],
        groupby=["release", "project_id", "started"],
        rollup=60 * 60,
        start=yesterday,
        conditions=_get_conditions(project_releases, environments),
        filter_keys={"project_id": list(x[0] for x in project_releases)},
    )["data"]:
        time_bucket = int((parse_snuba_datetime(x["started"]) - yesterday).total_seconds() / 3600)
        rv[x["project_id"], x["release"]]["stats"]["24h"][time_bucket] = x["uniq_sessions"]

    return rv

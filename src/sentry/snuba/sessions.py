from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.utils.snuba import raw_query, parse_snuba_datetime
from sentry.snuba.dataset import Dataset


def _get_conditions(project_releases, environments):
    conditions = [["release", "IN", list(x[1] for x in project_releases)]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])
    return conditions


def get_changed_project_release_model_materializations(project_ids):
    """This returns data for project-release model materializations that
    should be added to the `ProjectRelease` model.  This does not take
    environments into account.
    """
    user_totals = {}
    rv = []

    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["project_id", "users"],
        groupby=["project_id"],
        rollup=24 * 60 * 60,
        filter_keys={"project_id": project_ids},
    )["data"]:
        user_totals[x["project_id"]] = x["users"]

    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "project_id",
            "started",
            "release",
            "users",
            "sessions",
            "sessions_crashed",
            "sessions_crashed",
        ],
        groupby=["release", "project_id"],
        rollup=24 * 60 * 60,
        filter_keys={"project_id": project_ids},
    )["data"]:
        totals = float(user_totals.get(x["project_id"]))
        rv.append(
            {
                "date": parse_snuba_datetime(x["started"]),
                "project_id": x["project_id"],
                "release": x["release"],
                "sessions": x["sessions"],
                "crash_free_sessions": (
                    100 - x["sessions_crashed"] / float(x["sessions"]) * 100
                    if x["sessions"]
                    else None
                ),
                "adoption": x["users"] / totals * 100 if totals else None,
            }
        )

    return rv, user_totals


def get_release_health_data_overview(project_releases, environments=None):
    """Checks quickly for which of the given project releases we have
    health data available.  The argument is a tuple of `(project_id, release_name)`
    tuples.  The return value is a set of all the project releases that have health
    data.
    """

    def _nan_as_none(val):
        return None if val != val else val

    yesterday = datetime.utcnow() - timedelta(days=1)
    conditions = _get_conditions(project_releases, environments)

    total_users_24h = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["release", "users"],
        groupby=["release", "project_id"],
        rollup=24 * 60 * 60,
        conditions=conditions,
        filter_keys={"project_id": list(x[0] for x in project_releases)},
    )["data"]:
        total_users_24h[x["project_id"]] = x["users"]

    rv = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "release",
            "project_id",
            "duration",
            "users",
            "sessions",
            "sessions_crashed",
            "users_crashed",
        ],
        groupby=["release", "project_id", "started"],
        rollup=24 * 60 * 60,
        conditions=conditions,
        filter_keys={"project_id": list(x[0] for x in project_releases)},
    )["data"]:
        total_users = total_users_24h.get(x["project_id"])
        rv[x["project_id"], x["release"]] = {
            "duration_p50": _nan_as_none(x["duration_quantiles"][0]),
            "duration_p90": _nan_as_none(x["duration_quantiles"][1]),
            "crash_free_users": (
                100 - x["users_crashed"] / float(x["users"]) * 100 if x["users"] else None
            ),
            "crash_free_sessions": (
                100 - x["sessions_crashed"] / float(x["sessions"]) * 100 if x["sessions"] else None
            ),
            "total_users": x["users"],
            "total_sessions": x["sessions"],
            "adoption": x["users"] / total_users * 100 if total_users and x["users"] else None,
            "stats": {"24h": [0] * 24},
        }

    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["release", "project_id", "started", "sessions"],
        groupby=["release", "project_id", "started"],
        rollup=60 * 60,
        start=yesterday,
        conditions=conditions,
        filter_keys={"project_id": list(x[0] for x in project_releases)},
    )["data"]:
        time_bucket = int((parse_snuba_datetime(x["started"]) - yesterday).total_seconds() / 3600)
        rv[x["project_id"], x["release"]]["stats"]["24h"][time_bucket] = x["sessions"]

    return rv

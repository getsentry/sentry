from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.utils.snuba import raw_query, parse_snuba_datetime
from sentry.snuba.dataset import Dataset


def _get_conditions_and_filter_keys(project_releases, environments):
    conditions = [["release", "IN", list(x[1] for x in project_releases)]]
    if environments is not None:
        conditions.append(["environment", "IN", environments])
    filter_keys = {"project_id": list(set(x[0] for x in project_releases))}
    return conditions, filter_keys


def get_changed_project_release_model_adoptions(project_ids):
    """Given some project IDs returns adoption rates that should be updated
    on the postgres tables.
    """
    user_totals = {}
    yesterday = datetime.utcnow() - timedelta(days=1)
    rv = []

    # Get the 24 hour totals per release
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["project_id", "users"],
        groupby=["project_id"],
        start=yesterday,
        filter_keys={"project_id": project_ids},
    )["data"]:
        user_totals[x["project_id"]] = x["users"]

    # Find all releases with adoption in the last 24 hours
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "project_id",
            "release",
            "users",
            "users_crashed",
            "sessions",
            "sessions_crashed",
        ],
        groupby=["release", "project_id"],
        start=yesterday,
        filter_keys={"project_id": project_ids},
    )["data"]:
        totals = float(user_totals.get(x["project_id"]))
        rv.append(
            {
                "date": yesterday,
                "project_id": x["project_id"],
                "release": x["release"],
                "adoption": x["users"] / totals * 100 if totals else None,
                "crash_free_users": (
                    100 - x["users_crashed"] / float(x["users"]) * 100 if x["users"] else None
                ),
                "crash_free_sessions": (
                    100 - x["sessions_crashed"] / float(x["sessions"]) * 100
                    if x["sessions"]
                    else None
                ),
            }
        )

    return rv


def get_release_health_data_overview(project_releases, environments=None):
    """Checks quickly for which of the given project releases we have
    health data available.  The argument is a tuple of `(project_id, release_name)`
    tuples.  The return value is a set of all the project releases that have health
    data.
    """

    def _nan_as_none(val):
        return None if val != val else val

    yesterday = datetime.utcnow() - timedelta(days=1)
    conditions, filter_keys = _get_conditions_and_filter_keys(project_releases, environments)

    total_users_24h = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["release", "users"],
        groupby=["release", "project_id"],
        start=yesterday,
        conditions=conditions,
        filter_keys=filter_keys,
    )["data"]:
        total_users_24h[x["project_id"]] = x["users"]

    rv = {}
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[
            "release",
            "project_id",
            "duration_quantiles",
            "users",
            "sessions",
            "sessions_crashed",
            "users_crashed",
        ],
        groupby=["release", "project_id"],
        start=yesterday,
        conditions=conditions,
        filter_keys=filter_keys,
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

    # The resolution on started is hourly so this does the right thing by itself.
    for x in raw_query(
        dataset=Dataset.Sessions,
        selected_columns=["release", "project_id", "started", "sessions"],
        groupby=["release", "project_id", "started"],
        start=yesterday,
        conditions=conditions,
        filter_keys=filter_keys,
    )["data"]:
        time_bucket = int((parse_snuba_datetime(x["started"]) - yesterday).total_seconds() / 3600)
        rv[x["project_id"], x["release"]]["stats"]["24h"][time_bucket] = x["sessions"]

    return rv

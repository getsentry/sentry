from __future__ import absolute_import

from sentry.utils.snuba import raw_query
from sentry.snuba.dataset import Dataset


def check_releases_for_health_data(project_releases):
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
            conditions=[["release", "IN", list(x[1] for x in project_releases)]],
            filter_keys={"project_id": list(x[0] for x in project_releases)},
        )["data"]
    )

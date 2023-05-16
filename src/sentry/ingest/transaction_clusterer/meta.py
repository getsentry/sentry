""" Track metadata about clusterer runs """

from datetime import datetime, timezone
from typing import Optional, TypedDict

from sentry.models import Project

OPTION_NAME = "sentry:transaction_name_cluster_meta"


class ClustererMeta(TypedDict):
    runs: int
    first_run: int
    last_run: int


def get_clusterer_meta(project: Project) -> ClustererMeta:
    meta: Optional[ClustererMeta] = project.get_option(OPTION_NAME)
    return meta or {
        "runs": 0,
        "first_run": 0,
        "last_run": 0,
    }


def track_clusterer_run(project: Project) -> None:
    meta = get_clusterer_meta(project)
    meta["runs"] = min(meta["runs"] + 1, 999)  # don't keep bumping forever
    meta["last_run"] = now = int(datetime.now(timezone.utc).timestamp())
    if meta["first_run"] == 0:
        meta["first_run"] = now
    project.update_option(OPTION_NAME, meta)

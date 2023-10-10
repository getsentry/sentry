""" Track metadata about clusterer runs """

from datetime import datetime, timezone
from typing import Optional, TypedDict

from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.models.project import Project


class ClustererMeta(TypedDict):
    runs: int
    first_run: int
    last_run: int


def get_clusterer_meta(namespace: ClustererNamespace, project: Project) -> ClustererMeta:
    meta: Optional[ClustererMeta] = project.get_option(namespace.value.meta_store)
    return meta or {
        "runs": 0,
        "first_run": 0,
        "last_run": 0,
    }


def track_clusterer_run(namespace: ClustererNamespace, project: Project) -> None:
    meta = get_clusterer_meta(namespace, project)
    meta["runs"] = min(meta["runs"] + 1, 999)  # don't keep bumping forever
    meta["last_run"] = now = int(datetime.now(timezone.utc).timestamp())
    if meta["first_run"] == 0:
        meta["first_run"] = now
    project.update_option(namespace.value.meta_store, meta)

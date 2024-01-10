from __future__ import annotations

from datetime import datetime
from logging import getLogger

from sentry import search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.release_threshold import ReleaseThreshold
from sentry.models.release_threshold.constants import TriggerType
from sentry.search.events.constants import RELEASE_ALIAS

default_logger = getLogger("sentry.releases.servicer")


def get_new_issue_count_is_healthy(
    project: Project,
    release: Release,
    release_threshold: ReleaseThreshold,
    start: datetime,
    end: datetime,
) -> bool:
    query_kwargs = {
        "projects": [project],
        "date_from": start,
        "date_to": end,
        "count_hits": True,
        "limit": 1,  # we don't need the returned objects, just the total count
        "search_filters": [
            SearchFilter(
                key=(SearchKey(RELEASE_ALIAS)), operator="=", value=SearchValue(release.version)
            )
        ],
    }
    if release_threshold.environment:
        query_kwargs["environments"] = [release_threshold.environment]

    try:
        result = search.query(**query_kwargs)  # type: ignore
    except Exception:
        default_logger.exception(
            "There was an error trying to grab new issue count",
            extra={
                "project": project.id,
                "release": release.id,
                "release_threshold": release_threshold.id,
                "query_kwargs": query_kwargs,
            },
        )
        return False

    new_issues = result.hits
    # If no issues where found for the specified query, then no issues exist
    if new_issues is None:
        new_issues = 0

    baseline_value = release_threshold.value
    if release_threshold.trigger_type == TriggerType.OVER:
        # If new issues is under/equal the threshold value, then it is healthy
        return new_issues <= baseline_value
    # Else, if new issues is over/equal the threshold value, then it is healthy
    return new_issues >= baseline_value

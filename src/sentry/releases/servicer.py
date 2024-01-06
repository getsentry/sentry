from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from logging import Logger, getLogger
from typing import TYPE_CHECKING, Any, DefaultDict, Dict, List, Optional, TypedDict

from sentry import search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.serializers import serialize
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.release_threshold import ReleaseThreshold
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType
from sentry.releases.repository import ReleaseThresholdsRepository, TimeRange
from sentry.search.events.constants import RELEASE_ALIAS
from sentry.services.hybrid_cloud.organization import RpcOrganization

if TYPE_CHECKING:
    from sentry.models.organization import Organization


default_logger = getLogger("sentry.releases.servicer")


class SerializedThreshold(TypedDict):
    date: datetime
    environment: Dict[str, Any] | None
    project: Dict[str, Any]
    release: str
    threshold_type: int
    trigger_type: str
    value: int
    window_in_seconds: int


class EnrichedThreshold(SerializedThreshold):
    end: datetime
    is_healthy: bool
    key: str
    project_slug: str
    project_id: int
    start: datetime
    metric_value: int | None


@dataclass
class FlattenedThresholds:
    # TODO: this can probably be improved to a better data structure as the keys for both fields match
    thresholds_by_type: DefaultDict[int, Dict[str, List]]
    query_windows_by_type: DefaultDict[int, Dict[str, datetime]]


class ReleaseThresholdServicer:
    def __init__(
        self,
        repository: Optional[ReleaseThresholdsRepository] = None,
        logger: Logger = default_logger,
    ) -> None:
        self.repository = repository if repository else ReleaseThresholdsRepository()
        self.logger = logger

    def _get_new_issue_count_is_healthy(
        self,
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
                    key=SearchKey(RELEASE_ALIAS), operator="=", value=SearchValue(release.id)
                )
            ],
        }
        if release_threshold.environment:
            query_kwargs["environments"] = [release_threshold.environment]

        try:
            result = search.query(**query_kwargs)
        except Exception as e:
            self.logger.error(
                "There was an error trying to grab new issue count",
                exc_info=e,
                extra={
                    "project": project.id,
                    "release": release.id,
                    "release_threshold": release_threshold.id,
                    "query_kwargs": query_kwargs,
                },
            )
            return False

        new_issues = result.hits

        baseline_value = release_threshold.value
        if release_threshold.trigger_type == TriggerType.OVER:
            # If new issues is under/equal the threshold value, then it is healthy
            return new_issues <= baseline_value
        # Else, if new issues is over/equal the threshold value, then it is healthy
        return new_issues >= baseline_value

    def get_thresholds_by_type(
        self,
        organization: Organization | RpcOrganization,
        start: datetime,
        end: datetime,
        environments: Optional[List[str]] = None,
        project_slugs: Optional[List[str]] = None,
        versions: Optional[List[str]] = None,
    ) -> FlattenedThresholds:
        """
        TODO: this function should be broken down even more by logical steps on what it's doing
        """
        thresholds_by_type: DefaultDict[int, dict[str, list]] = defaultdict()
        query_windows_by_type: DefaultDict[int, dict[str, datetime]] = defaultdict()
        for release_thresholds in self.repository.get_release_thresholds(
            organization=organization,
            time_range=TimeRange(start=start, end=end),
            project_slugs=project_slugs,
            versions=versions,
            environments=environments,
        ):
            project = release_thresholds.project
            release = release_thresholds.release
            for i, threshold in enumerate(release_thresholds.thresholds):
                if threshold.threshold_type not in thresholds_by_type:
                    thresholds_by_type[threshold.threshold_type] = {
                        "project_ids": [],
                        "releases": [],
                        "thresholds": [],
                    }
                thresholds_by_type[threshold.threshold_type]["project_ids"].append(project.id)
                thresholds_by_type[threshold.threshold_type]["releases"].append(release.version)
                if threshold.threshold_type not in query_windows_by_type:
                    query_windows_by_type[threshold.threshold_type] = {
                        "start": datetime.now(tz=timezone.utc),
                        "end": datetime.now(tz=timezone.utc),
                    }

                latest_deploy = release_thresholds.get_latest_deploy_id_by_threshold(index=i)
                # NOTE: query window starts at the earliest release up until the latest threshold window
                if latest_deploy:
                    threshold_start = latest_deploy.date_finished
                else:
                    # release.date is annotated through a query and linter does not like the name change
                    threshold_start = release.date  # type: ignore

                query_windows_by_type[threshold.threshold_type]["start"] = min(
                    threshold_start, query_windows_by_type[threshold.threshold_type]["start"]
                )
                query_windows_by_type[threshold.threshold_type]["end"] = max(
                    threshold_start + timedelta(seconds=threshold.window_in_seconds),
                    query_windows_by_type[threshold.threshold_type]["end"],
                )
                # NOTE: enriched threshold is SERIALIZED
                # meaning project and environment models are dictionaries
                enriched_threshold: EnrichedThreshold = serialize(threshold)
                # NOTE: start/end for a threshold are different from start/end for querying data

                threshold_end = threshold_start + timedelta(seconds=threshold.window_in_seconds)
                is_healthy = False
                if threshold.threshold_type == ReleaseThresholdType.NEW_ISSUE_COUNT:
                    is_healthy = self._get_new_issue_count_is_healthy(
                        project=project,
                        release=release,
                        release_threshold=threshold,
                        start=threshold_start,
                        end=threshold_end,
                    )

                enriched_threshold.update(
                    {
                        "key": release_thresholds.get_threshold_key(),
                        "start": threshold_start,
                        "end": threshold_end,  # start + threshold.window
                        "release": release.version,
                        "project_slug": project.slug,
                        "project_id": project.id,
                        "is_healthy": is_healthy,
                    }
                )
                thresholds_by_type[threshold.threshold_type]["thresholds"].append(
                    enriched_threshold
                )

        return FlattenedThresholds(
            thresholds_by_type=thresholds_by_type,
            query_windows_by_type=query_windows_by_type,
        )

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, DefaultDict, Dict, List, Optional, TypedDict

from sentry.api.serializers import serialize
from sentry.releases.repository import ReleaseThresholdsRepository, TimeRange
from sentry.services.hybrid_cloud.organization import RpcOrganization

if TYPE_CHECKING:
    from sentry.models.deploy import Deploy
    from sentry.models.organization import Organization


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
    def __init__(self, repository: Optional[ReleaseThresholdsRepository] = None) -> None:
        self.repository = repository if repository else ReleaseThresholdsRepository()

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

                latest_deploy: Deploy | None = release_thresholds.get_latest_deploy_id_by_threshold(
                    index=i
                )
                # NOTE: query window starts at the earliest release up until the latest threshold window
                if latest_deploy:
                    threshold_start = latest_deploy.date_finished
                else:
                    threshold_start = release.date

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
                enriched_threshold.update(
                    {
                        "key": release_thresholds.get_threshold_key(),
                        "start": threshold_start,
                        "end": threshold_start
                        + timedelta(
                            seconds=threshold.window_in_seconds
                        ),  # start + threshold.window
                        "release": release.version,
                        "project_slug": project.slug,
                        "project_id": project.id,
                        "is_healthy": False,
                    }
                )
                thresholds_by_type[threshold.threshold_type]["thresholds"].append(
                    enriched_threshold
                )

        return FlattenedThresholds(
            thresholds_by_type=thresholds_by_type,
            query_windows_by_type=query_windows_by_type,
        )

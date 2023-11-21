from collections import namedtuple
from dataclasses import dataclass
from datetime import datetime
from typing import Generator, Optional, Sequence, Set

from sentry.api.utils import InvalidParams
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.utils import get_redis_client_for_ingest
from sentry.utils import json

DAY_IN_SECONDS = 86400


def _get_day_timestamps(
    start: datetime,
    end: datetime,
) -> Set[int]:
    # We compute the approximate day timestamps, assuming UTC as the timezone.
    start_in_seconds = int(start.timestamp() / DAY_IN_SECONDS) * DAY_IN_SECONDS
    end_in_seconds = int(end.timestamp() / DAY_IN_SECONDS) * DAY_IN_SECONDS

    current_time = start_in_seconds
    timestamps = set()
    while current_time <= end_in_seconds:
        timestamps.add(current_time)
        current_time += DAY_IN_SECONDS

    return timestamps


def get_cache_key_for_code_location(
    organization_id: int, project_id: int, metric_mri: str, timestamp: int
) -> str:
    # TODO: implement mri conversion.
    encoded_mri = metric_mri
    return f"mm:l:{{{organization_id}}}:{project_id}:{encoded_mri}:{timestamp}"


@dataclass(frozen=True)
class CodeLocationQuery:
    organization_id: int
    project_id: int
    metric_mri: str
    timestamp: int

    def build_cache_key(self) -> str:
        return get_cache_key_for_code_location(
            organization_id=self.organization_id,
            project_id=self.project_id,
            metric_mri=self.metric_mri,
            timestamp=self.timestamp,
        )


@dataclass(frozen=True)
class CodeLocationPayload:
    function: Optional[str]
    module: Optional[str]
    filename: Optional[str]
    abs_path: Optional[str]
    lineno: Optional[int]

    @staticmethod
    def from_json(json_string: str) -> "CodeLocationPayload":
        json_object = json.loads(json_string)
        return CodeLocationPayload(
            function=json_object.get("function"),
            module=json_object.get("module"),
            filename=json_object.get("filename"),
            abs_path=json_object.get("abs_path"),
            lineno=json_object.get("lineno"),
        )


MetricCodeLocations = namedtuple("MetricCodeLocations", "query code_locations")


class CodeLocationsFetcher:
    # The maximum number of keys that can be fetched by the fetcher.
    #
    # The estimation was naively done by supposing at most 10 metrics with 2 projects and at most 90 timestamps.
    MAXIMUM_KEYS = 2000
    BATCH_SIZE = 50

    def __init__(
        self,
        organization: Organization,
        projects: Set[Project],
        metric_mris: Set[str],
        timestamps: Set[int],
    ):
        self._organization = organization
        self._projects = projects
        self._metric_mris = metric_mris
        self._timestamps = timestamps

        self._redis_client = get_redis_client_for_ingest()

        self._validate()

    def _validate(self):
        total_combinations = len(self._projects) * len(self._metric_mris) * len(self._timestamps)
        if total_combinations >= self.MAXIMUM_KEYS:
            raise InvalidParams(
                "The request results in too many keys to be fetched, try to reduce the number of "
                "metrics, projects or the time interval"
            )

    def _code_location_queries(self) -> Generator[CodeLocationQuery, None, None]:
        for project in self._projects:
            for metric_mri in self._metric_mris:
                for timestamp in self._timestamps:
                    yield CodeLocationQuery(
                        organization_id=self._organization.id,
                        project_id=project.id,
                        metric_mri=metric_mri,
                        timestamp=timestamp,
                    )

    def _get_code_locations(
        self, queries: Sequence[CodeLocationQuery]
    ) -> Sequence[MetricCodeLocations]:
        pipeline = self._redis_client.pipeline()
        for query in queries:
            pipeline.smembers(query.build_cache_key())

        code_locations = []
        for query, locations in zip(queries, pipeline.execute()):
            if not locations:
                continue

            parsed_locations = [CodeLocationPayload.from_json(location) for location in locations]
            code_locations.append(MetricCodeLocations(query=query, code_locations=parsed_locations))

        return code_locations

    def fetch(self) -> Sequence[MetricCodeLocations]:
        code_locations = []
        for queries in self._in_batches(self._code_location_queries(), self.BATCH_SIZE):
            # We are assuming that code locations have each a unique query, thus we don't perform any merging or
            # de-duplication.
            code_locations += self._get_code_locations(queries)

        return code_locations

    @staticmethod
    def _in_batches(
        generator: Generator[CodeLocationQuery, None, None], size: int
    ) -> Generator[Sequence[CodeLocationQuery], None, None]:
        batch = []
        for value in generator:
            if len(batch) < size:
                batch.append(value)

            if len(batch) == size:
                yield batch
                batch = []

        # We flush out the remaining elements.
        if len(batch) > 0:
            yield batch


def get_code_locations(
    metric_mris: Sequence[str],
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
) -> Sequence[MetricCodeLocations]:
    fetcher = CodeLocationsFetcher(
        organization=organization,
        projects=set(projects),
        metric_mris=set(metric_mris),
        timestamps=_get_day_timestamps(start, end),
    )
    return fetcher.fetch()

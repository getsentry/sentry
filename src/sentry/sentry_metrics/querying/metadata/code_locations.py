from dataclasses import dataclass
from datetime import datetime
from typing import Generator, List, Optional, Sequence, Set

from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.utils import fnv1a_32, get_redis_client_for_metrics_meta
from sentry.utils import json, metrics

DAY_IN_SECONDS = 86400


@dataclass(frozen=True)
class CodeLocationQuery:
    organization_id: int
    project_id: int
    metric_mri: str
    timestamp: int


@dataclass(frozen=True)
class CodeLocationPayload:
    function: Optional[str]
    module: Optional[str]
    filename: Optional[str]
    abs_path: Optional[str]
    lineno: Optional[int]
    pre_context: Sequence[str]
    context_line: Optional[str]
    post_context: Sequence[str]


@dataclass(frozen=True)
class MetricCodeLocations:
    query: CodeLocationQuery
    frames: Sequence[CodeLocationPayload]

    def __hash__(self):
        # For the serializer we need to implement a hashing function that uniquely identifies a metric code location.
        return hash(self.query)


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
    # We opted to use this hash function since it is quite fast and has 1 collision every 50k entries approximately,
    # which for our case is more than enough since we discriminate via organization, project and timestamp, meaning that
    # it's highly unlikely that a project has more than 50k unique metric mris.
    hashed_mri = fnv1a_32(metric_mri.encode("utf-8"))
    return f"mm:l:{{{organization_id}}}:{project_id}:{hashed_mri}:{timestamp}"


class CodeLocationsFetcher:
    # The maximum number of keys that can be fetched by the fetcher.
    #
    # The estimation was naively done by supposing at most 10 metrics with 2 projects and at most 90 timestamps.
    MAXIMUM_KEYS = 2000
    # The size of the batch of keys that are fetched by endpoint.
    #
    # Batching is done via Redis pipeline and the goal is to improve the performance of the system.
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

        self._redis_client = get_redis_client_for_metrics_meta()

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

    def _parse_code_location_payload(self, encoded_location: str) -> CodeLocationPayload:
        try:
            decoded_location = json.loads(encoded_location)
            return CodeLocationPayload(
                function=decoded_location.get("function"),
                module=decoded_location.get("module"),
                filename=decoded_location.get("filename"),
                abs_path=decoded_location.get("abs_path"),
                lineno=decoded_location.get("lineno"),
                pre_context=decoded_location.get("pre_context", []),
                context_line=decoded_location.get("context_line"),
                post_context=decoded_location.get("post_context", []),
            )
        except Exception:
            raise InvalidParams("Invalid code location payload encountered")

    @metrics.wraps("ddm.code_locations.load_from_redis", tags={"batch_size": BATCH_SIZE})
    def _get_code_locations(
        self, queries: Sequence[CodeLocationQuery]
    ) -> Sequence[MetricCodeLocations]:
        pipeline = self._redis_client.pipeline()
        for query in queries:
            cache_key = get_cache_key_for_code_location(
                query.organization_id,
                query.project_id,
                query.metric_mri,
                query.timestamp,
            )
            pipeline.smembers(cache_key)

        frames = []
        for query, locations in zip(queries, pipeline.execute()):
            if not locations:
                continue

            parsed_locations = [
                self._parse_code_location_payload(location) for location in locations
            ]
            # To maintain consistent ordering, we sort by filename.
            sorted_locations = sorted(parsed_locations, key=lambda value: value.filename or "")
            frames.append(MetricCodeLocations(query=query, frames=sorted_locations))

        return frames

    def fetch(self) -> Sequence[MetricCodeLocations]:
        code_locations: List[MetricCodeLocations] = []
        for queries in self._in_batches(self._code_location_queries(), self.BATCH_SIZE):
            # We are assuming that code locations have each a unique query, thus we don't perform any merging or
            # de-duplication.
            code_locations += self._get_code_locations(queries)

        return code_locations

    @staticmethod
    def _in_batches(
        generator: Generator[CodeLocationQuery, None, None], size: int
    ) -> Generator[Sequence[CodeLocationQuery], None, None]:
        batch: List[CodeLocationQuery] = []
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
    return CodeLocationsFetcher(
        organization=organization,
        projects=set(projects),
        metric_mris=set(metric_mris),
        timestamps=_get_day_timestamps(start, end),
    ).fetch()

import math
from collections.abc import Generator, Sequence
from dataclasses import dataclass
from datetime import datetime

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.utils import get_redis_client_for_metrics_meta
from sentry.utils import json, metrics
from sentry.utils.hashlib import fnv1a_32

DAY_IN_SECONDS = 86400


@dataclass(frozen=True)
class CodeLocationQuery:
    organization_id: int
    project_id: int
    metric_mri: str
    timestamp: int


@dataclass(frozen=True)
class CodeLocationPayload:
    function: str | None
    module: str | None
    filename: str | None
    abs_path: str | None
    lineno: int | None
    pre_context: Sequence[str]
    context_line: str | None
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
) -> set[int]:
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
    # Note that each key might contain multiple code locations.
    MAXIMUM_KEYS = 50
    # The size of the batch of keys that are fetched by endpoint.
    #
    # Batching is done via Redis pipeline and the goal is to improve the performance of the system.
    BATCH_SIZE = 25
    # The maximum number of code locations we want to retrieve per Redis set.
    MAX_SET_SIZE = 10
    # The maximum number of code locations that we actually return per Redis set.
    MAX_LOCATIONS_SIZE = 5

    # Given the limits above, we can expect, in the worst case MAXIMUM_KEYS * MAX_LOCATIONS_SIZE elements being
    # returned because we further limit entries returned from Redis after loading them.

    def __init__(
        self,
        organization: Organization,
        projects: set[Project],
        metric_mris: set[str],
        timestamps: set[int],
    ):
        self._organization = organization
        self._projects = projects
        self._metric_mris = metric_mris
        self._timestamps = timestamps

        self._redis_client = get_redis_client_for_metrics_meta()

    def _code_location_queries(self) -> Generator[CodeLocationQuery, None, None]:
        total_count = len(self._projects) * len(self._metric_mris) * len(self._timestamps)
        step_size = (
            1 if total_count <= self.MAXIMUM_KEYS else math.ceil(total_count / self.MAXIMUM_KEYS)
        )

        # We want to distribute evenly and deterministically the elements in the set of combinations. For example, if
        # the total count of code locations queries you made is 100 and our maximum is 50, then we will sample 1 out of
        # 2 elements out of the 100 queries, to be within the 50.
        current_step = 0
        for project in self._projects:
            for metric_mri in self._metric_mris:
                for timestamp in self._timestamps:
                    if current_step % step_size == 0:
                        yield CodeLocationQuery(
                            organization_id=self._organization.id,
                            project_id=project.id,
                            metric_mri=metric_mri,
                            timestamp=timestamp,
                        )

                    current_step += 1

    def _parse_code_location_payload(self, encoded_location: str) -> CodeLocationPayload:
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
            pipeline.srandmember(cache_key, self.MAX_SET_SIZE)

        frames = []
        for query, locations in zip(queries, pipeline.execute()):
            if not locations:
                continue

            # To maintain consistent ordering, we sort by the location representation.
            locations = sorted(locations)[: self.MAX_LOCATIONS_SIZE]
            parsed_locations = [
                self._parse_code_location_payload(location) for location in locations
            ]

            frames.append(MetricCodeLocations(query=query, frames=parsed_locations))

        return frames

    def fetch(self) -> Sequence[MetricCodeLocations]:
        code_locations: list[MetricCodeLocations] = []
        for queries in self._in_batches(self._code_location_queries(), self.BATCH_SIZE):
            # We are assuming that code locations have each a unique query, thus we don't perform any merging or
            # de-duplication.
            code_locations += self._get_code_locations(queries)

        metrics.distribution("ddm.metrics_code_locations.fetched", value=len(code_locations))

        return code_locations

    @staticmethod
    def _in_batches(
        generator: Generator[CodeLocationQuery, None, None], size: int
    ) -> Generator[Sequence[CodeLocationQuery], None, None]:
        batch: list[CodeLocationQuery] = []
        for value in generator:
            if len(batch) < size:
                batch.append(value)

            if len(batch) == size:
                yield batch
                batch = []

        # We flush out the remaining elements.
        if len(batch) > 0:
            yield batch


def get_metric_code_locations(
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

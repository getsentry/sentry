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
    mri: str
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
    organization_id: int, project_id: int, mri: str, timestamp: int
) -> str:
    # We opted to use this hash function since it is quite fast and has 1 collision every 50k entries approximately,
    # which for our case is more than enough since we discriminate via organization, project and timestamp, meaning that
    # it's highly unlikely that a project has more than 50k unique metric mris.
    hashed_mri = fnv1a_32(mri.encode("utf-8"))
    return f"mm:l:{{{organization_id}}}:{project_id}:{hashed_mri}:{timestamp}"


class CodeLocationsFetcher:

    # Batching is done via Redis pipeline and the goal is to improve the performance of the system.
    BATCH_SIZE = 25
    MAX_SET_SIZE = 10
    MAX_LOCATIONS_SIZE = 5

    def __init__(
        self,
        organization: Organization,
        projects: set[Project],
        mris: set[str],
        timestamps: set[int],
        offset: int | None,
        limit: int | None,
    ):
        self._organization = organization
        self._projects = projects
        self._mris = mris
        self._timestamps = timestamps
        self._offset = offset
        self._limit = limit

        self._redis_client = get_redis_client_for_metrics_meta()
        self._has_more = False

    def _code_location_queries(self) -> Generator[CodeLocationQuery]:
        self._has_more = False

        index = 0
        for project in self._projects:
            for mri in self._mris:
                for timestamp in self._timestamps:
                    # We want to emit the code location query in the interval [offset, offset + limit).
                    if (
                        self._offset is None
                        or self._limit is None
                        or self._offset <= index < self._offset + self._limit
                    ):
                        yield CodeLocationQuery(
                            organization_id=self._organization.id,
                            project_id=project.id,
                            mri=mri,
                            timestamp=timestamp,
                        )
                    elif (
                        self._offset is not None
                        and self._limit is not None
                        and index >= self._offset + self._limit
                    ):
                        self._has_more = True
                        break

                    index += 1

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
                query.mri,
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

    def fetch(self) -> tuple[bool, Sequence[MetricCodeLocations]]:
        code_locations: list[MetricCodeLocations] = []
        for queries in self._in_batches(self._code_location_queries(), self.BATCH_SIZE):
            # We are assuming that code locations have each a unique query, thus we don't perform any merging or
            # de-duplication.
            code_locations += self._get_code_locations(queries)

        metrics.distribution("ddm.metrics_code_locations.fetched", value=len(code_locations))

        # For pagination reasons, we return whether we have more results to load by checking how many queries we emitted
        # and not how many code locations we loaded (since a query might load multiple code locations). This is not
        # intuitive, but it's a temporary solution to allow pagination with Redis.
        return self._has_more, code_locations

    @staticmethod
    def _in_batches(
        generator: Generator[CodeLocationQuery], size: int
    ) -> Generator[Sequence[CodeLocationQuery]]:
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
    mris: Sequence[str],
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
    offset: int | None = None,
    limit: int | None = None,
) -> tuple[bool, Sequence[MetricCodeLocations]]:
    return CodeLocationsFetcher(
        organization=organization,
        projects=set(projects),
        mris=set(mris),
        timestamps=_get_day_timestamps(start, end),
        offset=offset,
        limit=limit,
    ).fetch()

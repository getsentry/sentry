from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Generator, Generic, Iterable, List, Mapping, Optional, Set, Tuple, TypeVar

import sentry_sdk

from sentry import options
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.models.statistical_detectors import (
    RegressionGroup,
    RegressionType,
    get_regression_groups,
)
from sentry.search.events.fields import get_function_alias
from sentry.seer.utils import BreakpointData, detect_breakpoints
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.snuba import SnubaTSResult


class TrendType(Enum):
    Regressed = "regressed"
    Improved = "improved"
    Unchanged = "unchanged"


@dataclass(frozen=True)
class DetectorPayload:
    project_id: int
    group: str | int
    fingerprint: str | int
    count: float
    value: float
    timestamp: datetime


@dataclass(frozen=True)
class DetectorState(ABC):
    @classmethod
    @abstractmethod
    def from_redis_dict(cls, data: Any) -> DetectorState:
        ...

    @abstractmethod
    def to_redis_dict(self) -> Mapping[str | bytes, bytes | float | int | str]:
        ...

    @abstractmethod
    def should_auto_resolve(self, group: RegressionGroup, rel_threshold: float) -> bool:
        ...

    @classmethod
    @abstractmethod
    def empty(cls) -> DetectorState:
        ...


@dataclass(frozen=True)
class DetectorConfig(ABC):
    ...


C = TypeVar("C")
T = TypeVar("T")


class DetectorStore(ABC, Generic[T]):
    @abstractmethod
    def bulk_read_states(self, payloads: List[DetectorPayload]) -> List[T]:
        ...

    @abstractmethod
    def bulk_write_states(self, payloads: List[DetectorPayload], states: List[T]):
        ...


class DetectorAlgorithm(ABC, Generic[T]):
    @abstractmethod
    def __init__(
        self,
        source: str,
        kind: str,
        state: DetectorState,
        config: DetectorConfig,
    ):
        ...

    @abstractmethod
    def update(self, payload: DetectorPayload) -> Tuple[Optional[TrendType], float]:
        ...

    @property
    @abstractmethod
    def state(self) -> DetectorState:
        ...


@dataclass(frozen=True)
class RegressionDetector(ABC):
    source: str
    kind: str
    regression_type: RegressionType
    config: DetectorConfig
    store: DetectorStore
    state_cls: type[DetectorState]
    detector_cls: type[DetectorAlgorithm]
    min_change: int
    resolution_rel_threshold: float

    @classmethod
    def all_payloads(
        cls,
        projects: List[Project],
        start: datetime,
    ) -> Generator[DetectorPayload, None, None]:
        projects_per_query = options.get("statistical_detectors.query.batch_size")
        assert projects_per_query > 0

        for projects in chunked(projects, projects_per_query):
            try:
                yield from cls.query_payloads(projects, start)
            except Exception as e:
                sentry_sdk.capture_exception(e)

    @classmethod
    @abstractmethod
    def query_payloads(
        cls,
        projects: List[Project],
        start: datetime,
    ) -> Iterable[DetectorPayload]:
        ...

    @classmethod
    def detect_trends(
        cls, projects: List[Project], start: datetime
    ) -> Generator[Tuple[Optional[TrendType], float, DetectorPayload, DetectorState], None, None]:
        unique_project_ids: Set[int] = set()

        total_count = 0
        regressed_count = 0
        improved_count = 0

        for payloads in chunked(cls.all_payloads(projects, start), 100):
            total_count += len(payloads)

            raw_states = cls.store.bulk_read_states(payloads)

            states = []

            for raw_state, payload in zip(raw_states, payloads):
                try:
                    state = cls.state_cls.from_redis_dict(raw_state)
                except Exception as e:
                    state = cls.state_cls.empty()

                    if raw_state:
                        # empty raw state implies that there was no
                        # previous state so no need to capture an exception
                        sentry_sdk.capture_exception(e)

                algorithm = cls.detector_cls(cls.source, cls.kind, state, cls.config)
                trend_type, score = algorithm.update(payload)

                # the trend type can be None if no update happened,
                # pass None to indicate we do not need up update the state
                states.append(None if trend_type is None else algorithm.state.to_redis_dict())

                if trend_type == TrendType.Regressed:
                    regressed_count += 1
                elif trend_type == TrendType.Improved:
                    improved_count += 1

                unique_project_ids.add(payload.project_id)

                yield (trend_type, score, payload, algorithm.state)

            cls.store.bulk_write_states(payloads, states)

        metrics.incr(
            "statistical_detectors.projects.active",
            amount=len(unique_project_ids),
            tags={"source": cls.source, "kind": cls.kind},
            sample_rate=1.0,
        )

        metrics.incr(
            "statistical_detectors.objects.total",
            amount=total_count,
            tags={"source": cls.source, "kind": cls.kind},
            sample_rate=1.0,
        )

        metrics.incr(
            "statistical_detectors.objects.regressed",
            amount=regressed_count,
            tags={"source": cls.source, "kind": cls.kind},
            sample_rate=1.0,
        )

        metrics.incr(
            "statistical_detectors.objects.improved",
            amount=improved_count,
            tags={"source": cls.source, "kind": cls.kind},
            sample_rate=1.0,
        )

    @classmethod
    def all_timeseries(
        cls, objects: List[Tuple[Project, int | str]], start: datetime, function: str, chunk_size=25
    ) -> Generator[Tuple[int, int | str, SnubaTSResult], None, None]:
        # Snuba allows 10,000 data points per request. 14 days * 1hr * 24hr =
        # 336 data points per transaction name, so we can safely get 25 transaction
        # timeseries.
        for chunk in chunked(objects, chunk_size):
            try:
                yield from cls.query_timeseries(chunk, start, function)
            except Exception as e:
                sentry_sdk.capture_exception(e)

    @classmethod
    @abstractmethod
    def query_timeseries(
        cls,
        objects: List[Tuple[Project, int | str]],
        start: datetime,
        function: str,
    ) -> Iterable[Tuple[int, int | str, SnubaTSResult]]:
        ...

    @classmethod
    def detect_regressions(
        cls,
        objects: List[Tuple[Project, int | str]],
        start: datetime,
        function: str,
        timeseries_per_batch=10,
    ) -> Generator[BreakpointData, None, None]:
        serializer = SnubaTSResultSerializer(None, None, None)

        for chunk in chunked(cls.all_timeseries(objects, start, function), timeseries_per_batch):
            data = {}
            for project_id, object_name, result in chunk:
                serialized = serializer.serialize(result, get_function_alias(function))
                data[f"{project_id},{object_name}"] = {
                    "data": serialized["data"],
                    "data_start": serialized["start"],
                    "data_end": serialized["end"],
                    # only look at the last 3 days of the request data
                    "request_start": serialized["end"] - 3 * 24 * 60 * 60,
                    "request_end": serialized["end"],
                }

            request = {
                "data": data,
                "sort": "-trend_percentage()",
                "min_change()": cls.min_change,
                # "trend_percentage()": 0.5,  # require a minimum 50% increase
                # "validate_tail_hours": 6,
                # Disable the fall back to use the midpoint as the breakpoint
                # which was originally intended to detect a gradual regression
                # for the trends use case. That does not apply here.
                "allow_midpoint": "0",
            }

            try:
                yield from detect_breakpoints(request)["data"]
            except Exception as e:
                sentry_sdk.capture_exception(e)
                metrics.incr(
                    "statistical_detectors.breakpoint.errors",
                    tags={"source": cls.source, "kind": cls.kind},
                )

    @classmethod
    @abstractmethod
    def make_status_change_message(
        cls,
        payload: DetectorPayload,
        status: int,
        substatus: Optional[int] = None,
    ) -> StatusChangeMessage:
        ...

    @classmethod
    def redirect_resolutions(
        cls,
        trends: Generator[
            Tuple[Optional[TrendType], float, DetectorPayload, DetectorState], None, None
        ],
        timestamp: datetime,
        batch_size=1_000,
    ) -> Generator[Tuple[Optional[TrendType], float, DetectorPayload, DetectorState], None, None]:
        groups_to_update = []

        for trend_chunk in chunked(trends, batch_size):
            active_regression_groups = {
                (group.project_id, group.fingerprint): group
                for group in get_regression_groups(
                    cls.regression_type,
                    [
                        (payload.project_id, payload.fingerprint)
                        for trend_type, score, payload, state in trend_chunk
                    ],
                    active=True,
                )
            }

            for trend_type, score, payload, state in trend_chunk:
                group = active_regression_groups.get((payload.project_id, payload.fingerprint))
                if group is not None and state.should_auto_resolve(
                    group.baseline, cls.resolution_rel_threshold
                ):
                    group.active = False
                    group.date_resolved = timestamp
                    groups_to_update.append(group)

                    status_change = cls.make_status_change_message(
                        payload, status=GroupStatus.RESOLVED
                    )
                    produce_occurrence_to_kafka(
                        payload_type=PayloadType.STATUS_CHANGE,
                        status_change=status_change,
                    )
                else:
                    yield trend_type, score, payload, state

            RegressionGroup.objects.bulk_update(groups_to_update, ["active", "date_resolved"])

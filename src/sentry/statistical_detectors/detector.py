from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Generator, Generic, List, Mapping, Optional, Set, Tuple, TypeVar

import sentry_sdk

from sentry import options
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.iterators import chunked


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
    config: DetectorConfig
    store: DetectorStore
    state_cls: type[DetectorState]
    detector_cls: type[DetectorAlgorithm]

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
                continue

    @classmethod
    @abstractmethod
    def query_payloads(
        cls,
        projects: List[Project],
        start: datetime,
    ) -> List[DetectorPayload]:
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

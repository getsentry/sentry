from __future__ import annotations

import heapq
import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Generator, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import DefaultDict

import sentry_sdk

from sentry import options
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.issues.ingest import process_occurrence_data
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_consumer import bulk_get_groups_from_fingerprints
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.models.statistical_detectors import (
    RegressionGroup,
    RegressionType,
    get_regression_groups,
)
from sentry.search.events.fields import get_function_alias
from sentry.seer.breakpoints import (
    BreakpointData,
    BreakpointRequest,
    BreakpointTransaction,
    detect_breakpoints,
)
from sentry.statistical_detectors.algorithm import DetectorAlgorithm
from sentry.statistical_detectors.base import DetectorPayload, DetectorState, TrendType
from sentry.statistical_detectors.issue_platform_adapter import fingerprint_regression
from sentry.statistical_detectors.store import DetectorStore
from sentry.types.group import GroupSubStatus
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger("sentry.statistical_detectors.tasks")


@dataclass(frozen=True)
class TrendBundle:
    type: TrendType
    score: float
    payload: DetectorPayload
    state: DetectorState | None = None
    regression_group: RegressionGroup | None = None


@dataclass(frozen=True)
class RegressionDetector(ABC):
    source: str
    kind: str
    regression_type: RegressionType
    min_change: int
    buffer_period: timedelta
    resolution_rel_threshold: float
    escalation_rel_threshold: float

    @classmethod
    @abstractmethod
    def min_throughput_threshold(cls) -> int: ...

    @classmethod
    def configure_tags(cls):
        sentry_sdk.set_tag("regression.source", cls.source)
        sentry_sdk.set_tag("regression.kind", cls.source)

    @classmethod
    @abstractmethod
    def detector_algorithm_factory(cls) -> DetectorAlgorithm: ...

    @classmethod
    @abstractmethod
    def detector_store_factory(cls) -> DetectorStore: ...

    @classmethod
    def all_payloads(
        cls,
        projects: list[Project],
        start: datetime,
    ) -> Generator[DetectorPayload]:
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
        projects: list[Project],
        start: datetime,
    ) -> Iterable[DetectorPayload]: ...

    @classmethod
    def detect_trends(
        cls, projects: list[Project], start: datetime, batch_size=100
    ) -> Generator[TrendBundle]:
        unique_project_ids: set[int] = set()

        total_count = 0
        skipped_count = 0
        regressed_count = 0
        improved_count = 0

        algorithm = cls.detector_algorithm_factory()
        store = cls.detector_store_factory()

        for raw_payloads in chunked(cls.all_payloads(projects, start), batch_size):
            total_count += len(raw_payloads)

            raw_states = store.bulk_read_states(raw_payloads)

            payloads = []
            states = []

            for raw_state, payload in zip(raw_states, raw_payloads):
                # If the number of events is too low, then we skip updating
                # to minimize false positives
                if payload.count <= cls.min_throughput_threshold():
                    skipped_count += 1
                    continue

                metrics.distribution(
                    "statistical_detectors.objects.throughput",
                    value=payload.count,
                    tags={"source": cls.source, "kind": cls.kind},
                )
                unique_project_ids.add(payload.project_id)

                trend_type, score, new_state = algorithm.update(raw_state, payload)

                if trend_type == TrendType.Regressed:
                    regressed_count += 1
                elif trend_type == TrendType.Improved:
                    improved_count += 1

                payloads.append(payload)
                states.append(None if new_state is None else new_state.to_redis_dict())

                yield TrendBundle(
                    type=trend_type,
                    score=score,
                    payload=payload,
                    state=new_state,
                )

            if payloads and states:
                store.bulk_write_states(payloads, states)

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
            "statistical_detectors.objects.skipped",
            amount=skipped_count,
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
        cls, objects: list[tuple[Project, int | str]], start: datetime, function: str, chunk_size=25
    ) -> Generator[tuple[int, int | str, SnubaTSResult]]:
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
        objects: list[tuple[Project, int | str]],
        start: datetime,
        function: str,
    ) -> Iterable[tuple[int, int | str, SnubaTSResult]]: ...

    @classmethod
    def detect_regressions(
        cls,
        objects: list[tuple[Project, int | str]],
        start: datetime,
        function: str,
        timeseries_per_batch=10,
    ) -> Generator[BreakpointData]:
        serializer = SnubaTSResultSerializer(None, None, None)

        for chunk in chunked(cls.all_timeseries(objects, start, function), timeseries_per_batch):
            data: dict[str, BreakpointTransaction] = {}
            for project_id, object_name, result in chunk:
                serialized = serializer.serialize(result, get_function_alias(function))

                transaction: BreakpointTransaction = {
                    "data": serialized["data"],
                    "data_start": serialized["start"],
                    "data_end": serialized["end"],
                    # only look at the last 3 days of the request data
                    "request_start": serialized["end"] - 3 * 24 * 60 * 60,
                    "request_end": serialized["end"],
                }

                data[f"{project_id},{object_name}"] = transaction

            request: BreakpointRequest = {
                "data": data,
                "sort": "-trend_percentage()",
                "min_change": cls.min_change,
                # "trend_percentage": 0.5,  # require a minimum 50% increase
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
    def limit_regressions_by_project(
        cls,
        bundles: Generator[TrendBundle],
        ratelimit: int | None = None,
    ) -> Generator[TrendBundle]:
        if ratelimit is None:
            ratelimit = options.get("statistical_detectors.ratelimit.ema")

        regressions_by_project: DefaultDict[int, list[tuple[float, TrendBundle]]] = defaultdict(
            list
        )

        for bundle in bundles:
            if bundle.type != TrendType.Regressed:
                continue
            heapq.heappush(
                regressions_by_project[bundle.payload.project_id], (bundle.score, bundle)
            )

            while (
                ratelimit >= 0
                and len(regressions_by_project[bundle.payload.project_id]) > ratelimit
            ):
                heapq.heappop(regressions_by_project[bundle.payload.project_id])

        for regressions in regressions_by_project.values():
            for _, bundle in regressions:
                yield bundle

    @classmethod
    def make_status_change_message(
        cls,
        payload: DetectorPayload,
        status: int,
        substatus: int | None = None,
    ) -> StatusChangeMessage:
        return StatusChangeMessage(
            # To align with the issue, we need to use the full fingerprint here
            fingerprint=[generate_fingerprint(cls.regression_type, payload.group)],
            project_id=payload.project_id,
            new_status=status,
            new_substatus=substatus,
        )

    @classmethod
    def get_regression_groups(
        cls,
        bundles: Generator[TrendBundle],
        batch_size=100,
    ) -> Generator[TrendBundle]:
        for trend_chunk in chunked(bundles, batch_size):
            active_regression_groups = {
                (group.project_id, group.fingerprint): group
                for group in get_regression_groups(
                    cls.regression_type,
                    [
                        (
                            bundle.payload.project_id,
                            generate_fingerprint(cls.regression_type, bundle.payload.group),
                        )
                        for bundle in trend_chunk
                    ],
                    active=True,
                )
            }

            for bundle in trend_chunk:
                group = active_regression_groups.get(
                    (
                        bundle.payload.project_id,
                        generate_fingerprint(cls.regression_type, bundle.payload.group),
                    )
                )
                yield TrendBundle(
                    type=bundle.type,
                    score=bundle.score,
                    payload=bundle.payload,
                    state=bundle.state,
                    regression_group=group,
                )

    @classmethod
    def redirect_resolutions(
        cls,
        bundles: Generator[TrendBundle],
        timestamp: datetime,
        batch_size=100,
    ) -> Generator[TrendBundle]:
        groups_to_resolve = []

        for bundle in bundles:
            group = bundle.regression_group
            try:
                if (
                    group is not None
                    and bundle.state is not None
                    and bundle.state.should_auto_resolve(
                        group.baseline, cls.resolution_rel_threshold
                    )
                    # enforce a buffer window within which the issue cannot
                    # auto resolve to avoid the issue state changing frequently
                    and group.date_regressed + cls.buffer_period <= timestamp
                ):
                    group.active = False
                    group.date_resolved = timestamp
                    groups_to_resolve.append(group)

                    status_change = cls.make_status_change_message(
                        bundle.payload, status=GroupStatus.RESOLVED
                    )
                    produce_occurrence_to_kafka(
                        payload_type=PayloadType.STATUS_CHANGE,
                        status_change=status_change,
                    )

                else:
                    yield bundle
            except Exception as e:
                sentry_sdk.capture_exception(e)

        RegressionGroup.objects.bulk_update(groups_to_resolve, ["active", "date_resolved"])

        metrics.incr(
            "statistical_detectors.objects.auto_resolved",
            amount=len(groups_to_resolve),
            tags={"source": cls.source, "kind": cls.kind},
            sample_rate=1.0,
        )

    @classmethod
    def redirect_escalations(
        cls,
        bundles: Generator[TrendBundle],
        timestamp: datetime,
        batch_size=100,
    ) -> Generator[TrendBundle]:
        escalated = 0

        candidates = []

        for bundle in bundles:
            group = bundle.regression_group
            try:
                if (
                    group is not None
                    and bundle.state is not None
                    and bundle.state.should_escalate(
                        group.baseline,
                        group.regressed,
                        cls.min_change,
                        cls.escalation_rel_threshold,
                    )
                    # enforce a buffer window within which the issue cannot
                    # escalate to avoid the issue state changing frequently
                    and group.date_regressed + cls.buffer_period <= timestamp
                ):
                    candidates.append(bundle)
                else:
                    yield bundle
            except Exception as e:
                sentry_sdk.capture_exception(e)

        escalated_groups = []
        groups_to_escalate = []

        for bundle in cls._filter_escalating_groups(candidates, batch_size=batch_size):
            state = bundle.state
            group = bundle.regression_group

            if state is None or group is None:
                continue

            escalated += 1

            # mark the existing regression group as inactive
            # as we want to create a new one for the escalation
            group.active = False
            group.date_resolved = timestamp
            groups_to_escalate.append(group)

            # the escalation will use the current timestamp and
            # the current moving average as the new regression
            escalated_groups.append(
                RegressionGroup(
                    type=cls.regression_type.value,
                    date_regressed=timestamp,
                    version=group.version + 1,
                    active=True,
                    project_id=group.project_id,
                    fingerprint=group.fingerprint,
                    baseline=group.regressed,
                    regressed=state.get_moving_avg(),
                )
            )

            status_change = cls.make_status_change_message(
                bundle.payload, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ESCALATING
            )
            produce_occurrence_to_kafka(
                payload_type=PayloadType.STATUS_CHANGE,
                status_change=status_change,
            )

        RegressionGroup.objects.bulk_update(groups_to_escalate, ["active", "date_resolved"])
        RegressionGroup.objects.bulk_create(escalated_groups)

        metrics.incr(
            "statistical_detectors.objects.escalated",
            amount=escalated,
            tags={"source": cls.source, "kind": cls.kind},
            sample_rate=1.0,
        )

    @classmethod
    def _filter_escalating_groups(
        cls,
        bundles_to_escalate: list[TrendBundle],
        batch_size=100,
    ) -> Generator[TrendBundle]:
        for bundles in chunked(bundles_to_escalate, batch_size):
            pairs = {
                generate_issue_group_key(
                    bundle.payload.project_id,
                    generate_fingerprint(cls.regression_type, bundle.payload.group),
                ): bundle
                for bundle in bundles
            }

            issue_groups = bulk_get_groups_from_fingerprints(
                [(project_id, [fingerprint]) for project_id, fingerprint in pairs]
            )

            for key, bundle in pairs.items():
                issue_group = issue_groups.get(key)
                if issue_group is None:
                    sentry_sdk.capture_message("Missing issue group for regression issue")
                    continue

                if (
                    issue_group.status == GroupStatus.UNRESOLVED
                    and issue_group.substatus == GroupSubStatus.ONGOING
                ):
                    yield bundle
                elif (
                    issue_group.status == GroupStatus.IGNORED
                    and issue_group.substatus == GroupSubStatus.UNTIL_ESCALATING
                ):
                    yield bundle

    @classmethod
    def get_regression_versions(
        cls,
        regressions: Generator[BreakpointData],
        batch_size=100,
    ) -> Generator[tuple[int, datetime | None, BreakpointData]]:
        active_regressions = []

        for regression_chunk in chunked(regressions, batch_size):
            existing_regression_groups = {
                (group.project_id, group.fingerprint): group
                for group in get_regression_groups(
                    cls.regression_type,
                    [
                        (
                            int(regression["project"]),
                            generate_fingerprint(cls.regression_type, regression["transaction"]),
                        )
                        for regression in regression_chunk
                    ],
                )
            }

            for regression in regression_chunk:
                project_id = int(regression["project"])
                fingerprint = generate_fingerprint(cls.regression_type, regression["transaction"])
                group = existing_regression_groups.get((project_id, fingerprint))

                if group is None:
                    yield 0, None, regression
                elif not group.active:
                    yield group.version, group.date_regressed, regression
                else:
                    # There is an active regression group already, so we need to sync with the
                    # issue platform to detemine if a new regression group should be created.
                    active_regressions.append(
                        (generate_issue_group_key(project_id, fingerprint), group, regression)
                    )

        # Instead of doing it one by one, we opt to queue them into a list
        # and fetching the issue group in batches for efficiency.
        for triples in chunked(active_regressions, batch_size):
            groups_to_close = []

            # Sync the regression group with the issue group
            issue_groups = bulk_get_groups_from_fingerprints(
                [(project_id, [fingerprint]) for (project_id, fingerprint), _, _ in triples]
            )

            for key, regression_group, regression in triples:
                issue_group = issue_groups.get(key)
                if issue_group is None:
                    sentry_sdk.capture_message("Missing issue group for regression issue")
                    continue

                # Only status we care about is if there is a resolved issue group that
                # corresponds to the regression group. In that case, we should end
                # the active regression group and create a new regression group.
                if issue_group.status == GroupStatus.RESOLVED:
                    regression_group.active = False
                    groups_to_close.append(regression_group)
                    yield regression_group.version, regression_group.date_regressed, regression

            RegressionGroup.objects.bulk_update(groups_to_close, ["active"])

        metrics.incr(
            "statistical_detectors.breakpoint.skipped",
            amount=len(active_regressions),
            tags={"source": cls.source, "kind": cls.kind},
            sample_rate=1.0,
        )

    @classmethod
    def save_regressions_with_versions(
        cls,
        regressions: Generator[BreakpointData],
        batch_size=100,
    ) -> Generator[BreakpointData]:
        versioned_regressions = cls.get_regression_versions(regressions)

        for regression_chunk in chunked(versioned_regressions, batch_size):
            regression_groups = []

            for version, prev_date_regressed, regression in regression_chunk:
                date_regressed = datetime.fromtimestamp(regression["breakpoint"], timezone.utc)

                # enforce a buffer window after the date regressed after which the issue
                # cannot be changed to regressed again to avoid the issue state changing frequently
                if (
                    prev_date_regressed is not None
                    and prev_date_regressed + cls.buffer_period > date_regressed
                ):
                    continue

                regression_groups.append(
                    RegressionGroup(
                        type=cls.regression_type.value,
                        date_regressed=date_regressed,
                        version=version + 1,
                        active=True,
                        project_id=int(regression["project"]),
                        fingerprint=generate_fingerprint(
                            cls.regression_type, regression["transaction"]
                        ),
                        baseline=regression["aggregate_range_1"],
                        regressed=regression["aggregate_range_2"],
                    )
                )

                yield regression

            RegressionGroup.objects.bulk_create(regression_groups)


def generate_fingerprint(regression_type: RegressionType, name: str | int) -> str:
    if regression_type == RegressionType.ENDPOINT:
        return fingerprint_regression(name, full=True)
    elif regression_type == RegressionType.FUNCTION:
        return f"{int(name):x}"
    else:
        raise ValueError(f"Unsupported RegressionType: {regression_type}")


def generate_issue_group_key(project_id: int, fingerprint: str) -> tuple[int, str]:
    data = {
        "fingerprint": [fingerprint],
    }
    process_occurrence_data(data)
    return project_id, data["fingerprint"][0]

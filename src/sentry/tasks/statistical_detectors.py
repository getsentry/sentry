from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Generator, List, Set

import sentry_sdk
from django.utils import timezone
from snuba_sdk import (
    Column,
    Condition,
    CurriedFunction,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    LimitBy,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry import options
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba import functions
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.statistical_detectors import redis
from sentry.statistical_detectors.algorithm import (
    MovingAverageDetectorState,
    MovingAverageRelativeChangeDetector,
    MovingAverageRelativeChangeDetectorConfig,
)
from sentry.statistical_detectors.detector import DetectorPayload, TrendType
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.math import ExponentialMovingAverage
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger("sentry.tasks.statistical_detectors")


FUNCTIONS_PER_PROJECT = 100
PROJECTS_PER_BATCH = 1_000


@instrumented_task(
    name="sentry.tasks.statistical_detectors.run_detection",
    queue="performance.statistical_detector",
    max_retries=0,
)
def run_detection() -> None:
    if not options.get("statistical_detectors.enable"):
        return

    now = timezone.now()

    enabled_performance_projects: Set[int] = set(
        options.get("statistical_detectors.enable.projects.performance")
    )
    enabled_profiling_projects: Set[int] = set(
        options.get("statistical_detectors.enable.projects.profiling")
    )

    performance_projects = []
    profiling_projects = []

    # TODO: make the amount of projects per batch configurable
    for project in RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE),
        step=100,
    ):
        if project.flags.has_transactions and project.id in enabled_performance_projects:
            performance_projects.append((project.id, project.organization_id))

            if len(performance_projects) >= PROJECTS_PER_BATCH:
                detect_transaction_trends.delay(
                    [p[0] for p in performance_projects], [p[1] for p in performance_projects], now
                )
                performance_projects = []

        if project.flags.has_profiles and project.id in enabled_profiling_projects:
            profiling_projects.append(project.id)

            if len(profiling_projects) >= PROJECTS_PER_BATCH:
                detect_function_trends.delay(profiling_projects, now)
                profiling_projects = []

    # make sure to dispatch a task to handle the remaining projects
    if performance_projects:
        detect_transaction_trends.delay(performance_projects, now)
    if profiling_projects:
        detect_function_trends.delay(profiling_projects, now)


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_transaction_trends",
    queue="performance.statistical_detector",
    max_retries=0,
)
def detect_transaction_trends(
    org_ids: List[int], project_ids: List[int], start: datetime, **kwargs
) -> None:
    if not options.get("statistical_detectors.enable"):
        return
    # TODO: get the transactions_per_project from an option
    NUM_TRANSACTIONS_PER_PROJECT = 50
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)

    for project_id in project_ids:
        query_transactions(org_ids, project_id, start, end, NUM_TRANSACTIONS_PER_PROJECT)


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_function_trends",
    queue="profiling.statistical_detector",
    max_retries=0,
)
def detect_function_trends(project_ids: List[int], start: datetime, **kwargs) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    functions_count = 0
    regressed_count = 0
    improved_count = 0

    detector_config = MovingAverageRelativeChangeDetectorConfig(
        min_data_points=6,
        short_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 21),
        long_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 41),
        threshold=0.1,
    )

    detector_store = redis.RedisDetectorStore()

    for payloads in chunked(all_function_payloads(project_ids, start), 100):
        functions_count += len(payloads)

        raw_states = detector_store.bulk_read_states(payloads)

        states = []

        for raw_state, payload in zip(raw_states, payloads):
            try:
                state = MovingAverageDetectorState.from_redis_dict(raw_state)
            except Exception as e:
                state = MovingAverageDetectorState.empty()

                if raw_state:
                    # empty raw state implies that there was no
                    # previous state so no need to capture an exception
                    sentry_sdk.capture_exception(e)

            detector = MovingAverageRelativeChangeDetector(state, detector_config)
            trend_type = detector.update(payload)

            states.append(None if trend_type is None else detector.state.to_redis_dict())

            if trend_type == TrendType.Regressed:
                regressed_count += 1
            elif trend_type == TrendType.Improved:
                improved_count += 1

        detector_store.bulk_write_states(payloads, states)

    # This is the total number of functions examined in this iteration
    metrics.incr(
        "statistical_detectors.total.functions",
        amount=functions_count,
        sample_rate=1.0,
    )

    # This is the number of regressed functions found in this iteration
    metrics.incr(
        "statistical_detectors.regressed.functions",
        amount=regressed_count,
        sample_rate=1.0,
    )

    # This is the number of improved functions found in this iteration
    metrics.incr(
        "statistical_detectors.improved.functions",
        amount=improved_count,
        sample_rate=1.0,
    )

    # TODO: pass on the regressed/improved functions to the next task


def all_function_payloads(
    project_ids: List[int],
    start: datetime,
) -> Generator[DetectorPayload, None, None]:
    projects_per_query = options.get("statistical_detectors.query.batch_size")
    assert projects_per_query > 0

    for projects in chunked(Project.objects.filter(id__in=project_ids), projects_per_query):
        try:
            function_payloads = query_functions(projects, start)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue

        yield from function_payloads


def query_transactions(
    org_ids: List[int],
    project_ids: List[int],
    start: datetime,
    end: datetime,
    transactions_per_project: int,
) -> List[DetectorPayload]:

    duration_metric_id = indexer.resolve(
        UseCaseID.TRANSACTIONS, org_ids[0], str(TransactionMRI.DURATION.value)
    )
    transaction_name_metric_id = indexer.resolve(
        UseCaseID.TRANSACTIONS,
        org_ids[0],
        "transaction",
    )
    # TODO: Explain raw snql here

    query = Query(
        match=Entity(EntityKey.GenericMetricsDistributions.value),
        select=[
            Column("project_id"),
            Function(
                "arrayElement",
                (
                    CurriedFunction(
                        "quantilesIf",
                        [0.95],
                        (
                            Column("value"),
                            Function("equals", (Column("metric_id"), duration_metric_id)),
                        ),
                    ),
                    1,
                ),
                "p95",
            ),
            Function(
                "countIf",
                (Column("value"), Function("equals", (Column("metric_id"), duration_metric_id))),
                "count",
            ),
            Function(
                "transform",
                (
                    Column(f"tags_raw[{transaction_name_metric_id}]"),
                    Function("array", ("",)),
                    Function("array", ("<< unparameterized >>",)),
                ),
                "transaction_name",
            ),
        ],
        groupby=[
            Column("project_id"),
            Column("transaction_name"),
        ],
        where=[
            Condition(Column("org_id"), Op.IN, list(org_ids)),
            Condition(Column("project_id"), Op.IN, list(project_ids)),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("metric_id"), Op.EQ, duration_metric_id),
        ],
        limitby=LimitBy([Column("project_id")], transactions_per_project),
        orderby=[
            OrderBy(Column("project_id"), Direction.DESC),
            OrderBy(Column("count"), Direction.DESC),
        ],
        granularity=Granularity(60),
        limit=Limit(len(project_ids) * transactions_per_project),
    )
    request = Request(
        dataset=Dataset.Events.value,
        app_id="statistical_detectors",
        query=query,
        tenant_ids={
            "referrer": Referrer.STATISTICAL_DETECTORS_FETCH_TOP_TRANSACTION_NAMES.value,
            # HACK: the allocation policy is going to reject this query unless there is an org_id
            # passed in. The allocation policy will be updated to handle cross-org queries better
            # As it is now (09-13-2023), this query will likely be throttled (i.e be slower) by the allocation
            # policy as soon as we start scanning more than just the sentry org
            "organization_id": -42069,
        },
    )
    data = raw_snql_query(
        request, referrer=Referrer.STATISTICAL_DETECTORS_FETCH_TOP_TRANSACTION_NAMES.value
    )["data"]
    res = defaultdict(list)
    for row in data:
        res[row["project_id"]].append((row["transaction_name"], row["count"], row["p95"]))
    return [
        DetectorPayload(
            project_id=row["project_id"],
            group=row["transaction_name"],
            count=row["count"],
            value=row["p95"],
            timestamp=start,
        )
        for row in data
    ]


def query_functions(projects: List[Project], start: datetime) -> List[DetectorPayload]:
    params = _get_function_query_params(projects, start)

    # TODOs: handle any errors
    query_results = functions.query(
        selected_columns=[
            "project.id",
            "timestamp",
            "fingerprint",
            "count()",
            "p95()",
        ],
        query="is_application:1",
        params=params,
        orderby=["project.id", "-count()"],
        limit=FUNCTIONS_PER_PROJECT * len(projects),
        referrer=Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR.value,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        transform_alias_to_input_format=True,
    )

    return [
        DetectorPayload(
            project_id=row["project.id"],
            group=row["fingerprint"],
            count=row["count()"],
            value=row["p95()"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
        )
        for row in query_results["data"]
    ]


def _get_function_query_params(projects: List[Project], start: datetime) -> Dict[str, Any]:
    # The functions dataset only supports 1 hour granularity.
    # So we always look back at the last full hour that just elapsed.
    # And since the timestamps are truncated to the start of the hour
    # we just need to query for the 1 minute of data.
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)

    return {
        "start": start,
        "end": start + timedelta(minutes=1),
        "project_id": [project.id for project in projects],
        "project_objects": projects,
    }

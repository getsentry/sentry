from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Generator, List, Optional, Set, Tuple, Union, cast

import sentry_sdk
from django.utils import timezone as django_timezone
from snuba_sdk import (
    And,
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
    Or,
    OrderBy,
    Query,
    Request,
)

from sentry import options
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.profiles.utils import get_from_profiling_service
from sentry.search.events.builder import ProfileTopFunctionsTimeseriesQueryBuilder
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import QueryBuilderConfig
from sentry.seer.utils import BreakpointData, detect_breakpoints
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba import functions, metrics_performance
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.discover import zerofill
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.statistical_detectors import redis
from sentry.statistical_detectors.algorithm import (
    MovingAverageDetectorState,
    MovingAverageRelativeChangeDetector,
    MovingAverageRelativeChangeDetectorConfig,
)
from sentry.statistical_detectors.detector import DetectorPayload, TrendType
from sentry.statistical_detectors.issue_platform_adapter import send_regressions_to_plaform
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.iterators import chunked
from sentry.utils.math import ExponentialMovingAverage
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import SnubaTSResult, raw_snql_query

logger = logging.getLogger("sentry.tasks.statistical_detectors")


FUNCTIONS_PER_PROJECT = 100
FUNCTIONS_PER_BATCH = 1_000
TRANSACTIONS_PER_PROJECT = 50
TRANSACTIONS_PER_BATCH = 10
PROJECTS_PER_BATCH = 1_000
TIMESERIES_PER_BATCH = 10


@instrumented_task(
    name="sentry.tasks.statistical_detectors.run_detection",
    queue="performance.statistical_detector",
    max_retries=0,
)
def run_detection() -> None:
    if not options.get("statistical_detectors.enable"):
        return

    now = django_timezone.now()

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
            performance_projects.append(project)

            if len(performance_projects) >= PROJECTS_PER_BATCH:
                detect_transaction_trends.delay(
                    [p.organization_id for p in performance_projects],
                    [p.id for p in performance_projects],
                    now,
                )
                performance_projects = []

        if project.flags.has_profiles and project.id in enabled_profiling_projects:
            profiling_projects.append(project.id)

            if len(profiling_projects) >= PROJECTS_PER_BATCH:
                detect_function_trends.delay(profiling_projects, now)
                profiling_projects = []

    # make sure to dispatch a task to handle the remaining projects
    if performance_projects:
        detect_transaction_trends.delay(
            [p.organization_id for p in performance_projects],
            [p.id for p in performance_projects],
            now,
        )
    if profiling_projects:
        detect_function_trends.delay(profiling_projects, now)


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_transaction_trends",
    queue="performance.statistical_detector",
    max_retries=0,
)
def detect_transaction_trends(
    org_ids: List[int], project_ids: List[int], start: datetime, *args, **kwargs
) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    regressions = filter(
        lambda trend: trend[0] == TrendType.Regressed,
        _detect_transaction_trends(org_ids, project_ids, start),
    )

    delay = 12  # hours
    delayed_start = start + timedelta(hours=delay)

    for trends in chunked(regressions, TRANSACTIONS_PER_BATCH):
        detect_transaction_change_points.apply_async(
            args=[
                [(payload.project_id, payload.group) for _, payload in trends],
                delayed_start,
            ],
            # delay the check by delay hours because we want to make sure there
            # will be enough data after the potential change point to be confident
            # that a change has occurred
            countdown=delay * 60 * 60,
        )


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_transaction_change_points",
    queue="performance.statistical_detector",
    max_retries=0,
)
def detect_transaction_change_points(
    transactions: List[Tuple[int, str | int]], start: datetime, *args, **kwargs
) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    for project_id, transaction_name in transactions:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("regressed_project_id", project_id)
            scope.set_tag("regressed_transaction", transaction_name)
            scope.set_tag("breakpoint", "no")

            scope.set_context(
                "statistical_detectors",
                {"timestamp": start.isoformat()},
            )
            sentry_sdk.capture_message("Potential Transaction Regression")

    breakpoint_count = 0

    for breakpoints in chunked(_detect_transaction_change_points(transactions, start), 10):
        breakpoint_count += len(breakpoints)
        send_regressions_to_plaform(breakpoints, True)

    metrics.incr(
        "statistical_detectors.breakpoint.transactions",
        amount=len(breakpoints),
        sample_rate=1.0,
    )


def _detect_transaction_change_points(
    transactions: List[Tuple[int, Union[int, str]]],
    start: datetime,
) -> Generator[BreakpointData, None, None]:
    serializer = SnubaTSResultSerializer(None, None, None)

    trend_function = "p95(transaction.duration)"

    for chunk in chunked(
        query_transactions_timeseries(transactions, start, trend_function), TRANSACTIONS_PER_BATCH
    ):
        data = {}
        for project_id, transaction_name, result in chunk:
            serialized = serializer.serialize(result, get_function_alias(trend_function))
            data[f"{project_id},{transaction_name}"] = {
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
            "trendFunction": trend_function,
            # Disable the fall back to use the midpoint as the breakpoint
            # which was originally intended to detect a gradual regression
            # for the trends use case. That does not apply here.
            "allow_midpoint": "0",
        }

        try:
            yield from detect_breakpoints(request)["data"]
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue


def _detect_transaction_trends(
    org_ids: List[int], project_ids: List[int], start: datetime
) -> Generator[Tuple[Optional[TrendType], DetectorPayload], None, None]:
    transactions_count = 0
    regressed_count = 0
    improved_count = 0

    detector_config = MovingAverageRelativeChangeDetectorConfig(
        min_data_points=6,
        short_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 21),
        long_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 41),
        threshold=0.1,
    )

    detector_store = redis.TransactionDetectorStore()

    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)
    all_transaction_payloads = query_transactions(
        org_ids, project_ids, start, end, TRANSACTIONS_PER_PROJECT
    )

    for payloads in chunked(all_transaction_payloads, 100):
        transactions_count += len(payloads)

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

            yield (trend_type, payload)

        detector_store.bulk_write_states(payloads, states)

    # This is the total number of functions examined in this iteration
    metrics.incr(
        "statistical_detectors.total.transactions",
        amount=transactions_count,
        sample_rate=1.0,
    )

    # This is the number of regressed functions found in this iteration
    metrics.incr(
        "statistical_detectors.regressed.transactions",
        amount=regressed_count,
        sample_rate=1.0,
    )

    # This is the number of improved functions found in this iteration
    metrics.incr(
        "statistical_detectors.improved.transactions",
        amount=improved_count,
        sample_rate=1.0,
    )


def query_transactions_timeseries(
    transactions: List[Tuple[int, int | str]],
    start: datetime,
    agg_function: str,
) -> Generator[Tuple[int, Union[int, str], SnubaTSResult], None, None]:
    end = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    interval = 3600  # 1 hour

    # TODO: batch cross-project (and cross-org) timeseries queries
    # (currently only txns in the same project are batched)
    grouped_transactions = defaultdict(list)
    for project_id, transaction_name in transactions:
        grouped_transactions[project_id].append(transaction_name)

    for project_id, transaction_names in grouped_transactions.items():
        params: Dict[str, Any] = {
            "start": end - timedelta(days=14),
            "end": end,
            "project_id": [project_id],
            "project_objects": [Project.objects.get(id=project_id)],
        }

        # Snuba allows 10,000 data points per request. 14 days * 1hr * 24hr =
        # 336 data points per transaction name, so we can safely get 25 transaction
        # timeseries.
        chunk_size = 25

        for transactions_chunk in chunked(transaction_names, chunk_size):
            escaped_transaction_names = [
                transaction_name.replace('"', '\\"') for transaction_name in transactions_chunk
            ]
            query = " OR ".join([f'transaction:"{name}"' for name in escaped_transaction_names])

            raw_results = metrics_performance.timeseries_query(
                selected_columns=["project_id", "transaction", agg_function],
                query=query,
                params=params,
                rollup=interval,
                referrer=Referrer.API_PERFORMANCE_TRANSACTIONS_STATISTICAL_DETECTOR_STATS.value,
                groupby=Column("transaction"),
                zerofill_results=False,
            )

            results = {}
            for index, datapoint in enumerate(raw_results.data.get("data") or []):
                transaction_name = datapoint["transaction"]
                if transaction_name not in results:
                    results[transaction_name] = {
                        "order": index,
                        "data": [datapoint],
                    }
                else:
                    data = cast(List, results[transaction_name]["data"])
                    data.append(datapoint)

            for transaction_name, item in results.items():
                formatted_result = SnubaTSResult(
                    {
                        "data": zerofill(
                            item["data"],
                            params["start"],
                            params["end"],
                            interval,
                            "time",
                        ),
                        "project": project_id,
                        "order": item["order"],
                    },
                    params["start"],
                    params["end"],
                    interval,
                )
                yield project_id, transaction_name, formatted_result


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_function_trends",
    queue="profiling.statistical_detector",
    max_retries=0,
)
def detect_function_trends(project_ids: List[int], start: datetime, *args, **kwargs) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    trends = _detect_function_trends(project_ids, start)
    regressions = filter(lambda trend: trend[0] == TrendType.Regressed, trends)

    delay = 12  # hours
    delayed_start = start + timedelta(hours=delay)

    for regression_chunk in chunked(regressions, FUNCTIONS_PER_BATCH):
        detect_function_change_points.apply_async(
            args=[
                [(payload.project_id, payload.group) for _, payload in regression_chunk],
                delayed_start,
            ],
            # delay the check by delay hours because we want to make sure there
            # will be enough data after the potential change point to be confident
            # that a change has occurred
            countdown=delay * 60 * 60,
        )


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_function_change_points",
    queue="profiling.statistical_detector",
    max_retries=0,
)
def detect_function_change_points(
    functions_list: List[Tuple[int, int]], start: datetime, *args, **kwargs
) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    for project_id, fingerprint in functions_list:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("regressed_project_id", project_id)
            scope.set_tag("regressed_function_id", fingerprint)
            scope.set_tag("breakpoint", "no")

            scope.set_context(
                "statistical_detectors",
                {"timestamp": start.isoformat()},
            )
            sentry_sdk.capture_message("Potential Function Regression")

    breakpoint_count = 0
    emitted_count = 0

    breakpoints = _detect_function_change_points(functions_list, start)

    chunk_size = 100

    for breakpoint_chunk in chunked(breakpoints, chunk_size):
        breakpoint_count += len(breakpoint_chunk)
        emitted_count += emit_function_regression_issue(breakpoint_chunk, start)

    metrics.incr(
        "statistical_detectors.breakpoint.functions",
        amount=breakpoint_count,
        sample_rate=1.0,
    )

    metrics.incr(
        "statistical_detectors.emitted.functions",
        amount=emitted_count,
        sample_rate=1.0,
    )


def _detect_function_trends(
    project_ids: List[int], start: datetime
) -> Generator[Tuple[Optional[TrendType], DetectorPayload], None, None]:
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

            yield (trend_type, payload)

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


def _detect_function_change_points(
    functions_list: List[Tuple[int, int]],
    start: datetime,
) -> Generator[BreakpointData, None, None]:
    serializer = SnubaTSResultSerializer(None, None, None)

    trend_function = "p95()"

    for chunk in chunked(
        all_function_timeseries(functions_list, start, trend_function), TIMESERIES_PER_BATCH
    ):
        data = {}
        for project_id, fingerprint, timeseries in chunk:
            serialized = serializer.serialize(timeseries, get_function_alias(trend_function))
            data[f"{project_id},{fingerprint}"] = {
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
            "trendFunction": trend_function,
            # Disable the fall back to use the midpoint as the breakpoint
            # which was originally intended to detect a gradual regression
            # for the trends use case. That does not apply here.
            "allow_midpoint": "0",
        }

        try:
            yield from detect_breakpoints(request)["data"]
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue


def emit_function_regression_issue(
    breakpoints: List[BreakpointData],
    start: datetime,
) -> int:
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)

    project_ids = [int(entry["project"]) for entry in breakpoints]
    projects = Project.objects.filter(id__in=project_ids)
    projects_by_id = {project.id: project for project in projects}

    params: Dict[str, Any] = {
        "start": start,
        "end": start + timedelta(minutes=1),
        "project_id": project_ids,
        "project_objects": projects,
    }

    conditions = [
        And(
            [
                Condition(Column("project_id"), Op.EQ, int(entry["project"])),
                Condition(Column("fingerprint"), Op.EQ, int(entry["transaction"])),
            ]
        )
        for entry in breakpoints
    ]

    result = functions.query(
        selected_columns=["project.id", "fingerprint", "worst()"],
        query="is_application:1",
        params=params,
        orderby=["project.id"],
        limit=len(breakpoints),
        referrer=Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_EXAMPLE.value,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        transform_alias_to_input_format=True,
        conditions=conditions if len(conditions) <= 1 else [Or(conditions)],
    )

    examples = {(row["project.id"], row["fingerprint"]): row["worst()"] for row in result["data"]}

    payloads = []

    for entry in breakpoints:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("breakpoint", "yes")
            scope.set_tag("regressed_project_id", entry["project"])
            # the service was originally meant for transactions so this
            # naming is a result of this
            scope.set_tag("regressed_function_id", entry["transaction"])

            breakpoint_ts = datetime.fromtimestamp(entry["breakpoint"], tz=timezone.utc)
            scope.set_context(
                "statistical_detectors",
                {
                    **entry,
                    "timestamp": start.isoformat(),
                    "breakpoint_timestamp": breakpoint_ts.isoformat(),
                },
            )
            sentry_sdk.capture_message("Potential Function Regression")

        project_id = int(entry["project"])
        fingerprint = int(entry["transaction"])
        example = examples.get((project_id, fingerprint))
        if example is None:
            continue

        project = projects_by_id.get(project_id)
        if project is None:
            continue

        payloads.append(
            {
                "organization_id": project.organization_id,
                "project_id": project_id,
                "profile_id": example,
                "fingerprint": fingerprint,
                "absolute_percentage_change": entry["absolute_percentage_change"],
                "aggregate_range_1": entry["aggregate_range_1"],
                "aggregate_range_2": entry["aggregate_range_2"],
                "breakpoint": int(entry["breakpoint"]),
                "trend_difference": entry["trend_difference"],
                "trend_percentage": entry["trend_percentage"],
                "unweighted_p_value": entry["unweighted_p_value"],
                "unweighted_t_value": entry["unweighted_t_value"],
            }
        )

    response = get_from_profiling_service(method="POST", path="/regressed", json_data=payloads)
    if response.status != 200:
        return 0

    data = json.loads(response.data)
    return data.get("occurrences")


def all_function_payloads(
    project_ids: List[int],
    start: datetime,
) -> Generator[DetectorPayload, None, None]:
    projects_per_query = options.get("statistical_detectors.query.batch_size")
    assert projects_per_query > 0

    for projects in chunked(Project.objects.filter(id__in=project_ids), projects_per_query):
        try:
            yield from query_functions(projects, start)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue


def all_function_timeseries(
    functions_list: List[Tuple[int, int]],
    start: datetime,
    trend_function: str,
) -> Generator[Tuple[int, int, Any], None, None]:
    # make sure that each chunk can fit in the 10,000 row limit imposed by snuba
    for functions_chunk in chunked(functions_list, 25):
        try:
            yield from query_functions_timeseries(functions_chunk, start, trend_function)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue


def query_transactions(
    org_ids: List[int],
    project_ids: List[int],
    start: datetime,
    end: datetime,
    transactions_per_project: int,
) -> List[DetectorPayload]:
    use_case_id = UseCaseID.TRANSACTIONS

    # both the metric and tag that we are using are hardcoded values in sentry_metrics.indexer.strings
    # so the org_id that we are using does not actually matter here, we only need to pass in an org_id
    duration_metric_id = indexer.resolve(
        use_case_id, org_ids[0], str(TransactionMRI.DURATION.value)
    )
    transaction_name_metric_id = indexer.resolve(
        use_case_id,
        org_ids[0],
        "transaction",
    )

    # if our time range is more than an hour, use the hourly granularity
    granularity = 3600 if int(end.timestamp()) - int(start.timestamp()) >= 3600 else 60

    # This query returns the top `transactions_per_project` transaction names by count in the specified
    # [start, end) time period along with the p95 of each transaction in that time period
    # this is written in raw SnQL because the metrics layer does not support the limitby clause which is necessary for this operation to work

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
        granularity=Granularity(granularity),
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
            "use_case_id": use_case_id.value,
        },
    )
    data = raw_snql_query(
        request, referrer=Referrer.STATISTICAL_DETECTORS_FETCH_TOP_TRANSACTION_NAMES.value
    )["data"]
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
    # The functions dataset only supports 1 hour granularity.
    # So we always look back at the last full hour that just elapsed.
    # And since the timestamps are truncated to the start of the hour
    # we just need to query for the 1 minute of data.
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)
    params: Dict[str, Any] = {
        "start": start,
        "end": start + timedelta(minutes=1),
        "project_id": [project.id for project in projects],
        "project_objects": projects,
    }

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
        limitby=("project.id", FUNCTIONS_PER_PROJECT),
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


def query_functions_timeseries(
    functions_list: List[Tuple[int, int]],
    start: datetime,
    agg_function: str,
) -> Generator[Tuple[int, int, Any], None, None]:
    project_ids = [project_id for project_id, _ in functions_list]
    projects = Project.objects.filter(id__in=project_ids)

    # take the last 14 days as our window
    end = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    params: Dict[str, Any] = {
        "start": end - timedelta(days=14),
        "end": end,
        "project_id": project_ids,
        "project_objects": projects,
    }
    interval = 3600  # 1 hour

    chunk: List[Dict[str, Any]] = [
        {
            "project.id": project_id,
            "fingerprint": fingerprint,
        }
        for project_id, fingerprint in functions_list
    ]

    builder = ProfileTopFunctionsTimeseriesQueryBuilder(
        dataset=Dataset.Functions,
        params=params,
        interval=interval,
        top_events=chunk,
        other=False,
        query="is_application:1",
        selected_columns=["project.id", "fingerprint"],
        timeseries_columns=[agg_function],
        config=QueryBuilderConfig(
            skip_tag_resolution=True,
        ),
    )
    raw_results = raw_snql_query(
        builder.get_snql_query(),
        referrer=Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_STATS.value,
    )

    results = functions.format_top_events_timeseries_results(
        raw_results,
        builder,
        params,
        interval,
        top_events={"data": chunk},
        result_key_order=["project.id", "fingerprint"],
    )

    for project_id, fingerprint in functions_list:
        key = f"{project_id},{fingerprint}"
        if key not in results:
            logger.warning(
                "Missing timeseries for project: {} function: {}",
                project_id,
                fingerprint,
            )
            continue
        yield project_id, fingerprint, results[key]

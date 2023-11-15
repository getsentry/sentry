from __future__ import annotations

import heapq
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, DefaultDict, Dict, Generator, List, Optional, Set, Tuple, Union

import sentry_sdk
from django.utils import timezone as django_timezone
from snuba_sdk import (
    And,
    BooleanCondition,
    BooleanOp,
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

from sentry import features, options, projectoptions
from sentry.api.endpoints.project_performance_issue_settings import InternalProjectOptions
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.constants import ObjectStatus
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.profiles.utils import get_from_profiling_service
from sentry.search.events.builder import ProfileTopFunctionsTimeseriesQueryBuilder
from sentry.search.events.fields import get_function_alias
from sentry.search.events.types import QueryBuilderConfig
from sentry.seer.utils import BreakpointData, detect_breakpoints
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba import functions
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
from sentry.statistical_detectors.issue_platform_adapter import send_regression_to_platform
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.iterators import chunked
from sentry.utils.math import ExponentialMovingAverage
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import SnubaTSResult, raw_snql_query

logger = logging.getLogger("sentry.tasks.statistical_detectors")


FUNCTIONS_PER_PROJECT = 50
FUNCTIONS_PER_BATCH = 1_000
TRANSACTIONS_PER_PROJECT = 50
TRANSACTIONS_PER_BATCH = 1_000
PROJECTS_PER_BATCH = 1_000
TIMESERIES_PER_BATCH = 10


def get_performance_project_settings(projects: List[Project]):
    project_settings = {}

    project_option_settings = ProjectOption.objects.get_value_bulk(
        projects, "sentry:performance_issue_settings"
    )

    for project in projects:
        default_project_settings = projectoptions.get_well_known_default(
            "sentry:performance_issue_settings",
            project=project,
        )

        project_settings[project] = {
            **default_project_settings,
            **(project_option_settings[project] or {}),
        }  # Merge saved project settings into default so updating the default to add new settings works in the future.

    return project_settings


def all_projects_with_settings():
    for projects in chunked(
        RangeQuerySetWrapper(
            Project.objects.filter(status=ObjectStatus.ACTIVE).select_related("organization"),
            step=100,
        ),
        100,
    ):
        project_settings = get_performance_project_settings(projects)
        for project in projects:
            yield project, project_settings[project]


@instrumented_task(
    name="sentry.tasks.statistical_detectors.run_detection",
    queue="performance.statistical_detector",
    max_retries=0,
)
def run_detection() -> None:
    if not options.get("statistical_detectors.enable"):
        return

    now = django_timezone.now()

    performance_projects = []
    profiling_projects = []

    performance_projects_count = 0
    profiling_projects_count = 0

    for project, project_settings in all_projects_with_settings():
        if project.flags.has_transactions and (
            features.has(
                "organizations:performance-statistical-detectors-ema", project.organization
            )
            and project_settings[InternalProjectOptions.TRANSACTION_DURATION_REGRESSION.value]
        ):
            performance_projects.append(project)
            performance_projects_count += 1

            if len(performance_projects) >= PROJECTS_PER_BATCH:
                detect_transaction_trends.delay(
                    list({p.organization_id for p in performance_projects}),
                    [p.id for p in performance_projects],
                    now,
                )
                performance_projects = []

        if project.flags.has_profiles and (
            features.has("organizations:profiling-statistical-detectors-ema", project.organization)
        ):
            profiling_projects.append(project.id)
            profiling_projects_count += 1

            if len(profiling_projects) >= PROJECTS_PER_BATCH:
                detect_function_trends.delay(profiling_projects, now)
                profiling_projects = []

    # make sure to dispatch a task to handle the remaining projects
    if performance_projects:
        detect_transaction_trends.delay(
            list({p.organization_id for p in performance_projects}),
            [p.id for p in performance_projects],
            now,
        )
    if profiling_projects:
        detect_function_trends.delay(profiling_projects, now)

    metrics.incr(
        "statistical_detectors.performance.projects.total",
        amount=performance_projects_count,
        sample_rate=1.0,
    )

    metrics.incr(
        "statistical_detectors.profiling.projects.total",
        amount=profiling_projects_count,
        sample_rate=1.0,
    )


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

    ratelimit = options.get("statistical_detectors.ratelimit.ema")
    trends = _detect_transaction_trends(org_ids, project_ids, start)
    regressions = limit_regressions_by_project(trends, ratelimit)

    delay = 12  # hours
    delayed_start = start + timedelta(hours=delay)

    for regression_chunk in chunked(regressions, TRANSACTIONS_PER_BATCH):
        detect_transaction_change_points.apply_async(
            args=[
                [(payload.project_id, payload.group) for payload in regression_chunk],
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

    projects_by_id = {
        project.id: project
        for project in Project.objects.filter(
            id__in=[project_id for project_id, _ in transactions]
        ).select_related("organization")
        if (
            features.has(
                "organizations:performance-statistical-detectors-breakpoint", project.organization
            )
        )
    }

    transaction_pairs: List[Tuple[Project, Union[int, str]]] = [
        (projects_by_id[item[0]], item[1]) for item in transactions if item[0] in projects_by_id
    ]

    breakpoint_count = 0

    for regression in _detect_transaction_change_points(transaction_pairs, start):
        breakpoint_count += 1
        project = projects_by_id.get(int(regression["project"]))
        released = project is not None and features.has(
            "organizations:performance-p95-endpoint-regression-ingest",
            project.organization,
        )
        send_regression_to_platform(regression, released)

    metrics.incr(
        "statistical_detectors.breakpoint.transactions",
        amount=breakpoint_count,
        sample_rate=1.0,
    )


def _detect_transaction_change_points(
    transactions: List[Tuple[Project, Union[int, str]]],
    start: datetime,
) -> Generator[BreakpointData, None, None]:
    serializer = SnubaTSResultSerializer(None, None, None)

    trend_function = "p95(transaction.duration)"

    for chunk in chunked(
        query_transactions_timeseries(transactions, start, trend_function), TIMESERIES_PER_BATCH
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
            "min_change()": 200,  # require a minimum 200ms increase (in ms)
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
            continue


def get_all_transaction_payloads(
    org_ids: List[int], project_ids: List[int], start: datetime, end: datetime
) -> Generator[DetectorPayload, None, None]:
    projects_per_query = options.get("statistical_detectors.query.batch_size")
    assert projects_per_query > 0

    for chunked_project_ids in chunked(project_ids, projects_per_query):
        try:
            yield from query_transactions(
                org_ids, chunked_project_ids, start, end, TRANSACTIONS_PER_PROJECT
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue


def _detect_transaction_trends(
    org_ids: List[int], project_ids: List[int], start: datetime
) -> Generator[Tuple[Optional[TrendType], float, DetectorPayload], None, None]:
    unique_project_ids: Set[int] = set()

    transactions_count = 0
    regressed_count = 0
    improved_count = 0

    detector_config = MovingAverageRelativeChangeDetectorConfig(
        change_metric="statistical_detectors.rel_change.transactions",
        min_data_points=6,
        short_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 21),
        long_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 41),
        threshold=0.2,
    )

    detector_store = redis.TransactionDetectorStore()

    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)
    all_transaction_payloads = get_all_transaction_payloads(org_ids, project_ids, start, end)

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
            trend_type, score = detector.update(payload)
            states.append(None if trend_type is None else detector.state.to_redis_dict())

            if trend_type == TrendType.Regressed:
                regressed_count += 1
            elif trend_type == TrendType.Improved:
                improved_count += 1

            unique_project_ids.add(payload.project_id)

            yield (trend_type, score, payload)

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

    metrics.incr(
        "statistical_detectors.performance.projects.active",
        amount=len(unique_project_ids),
        sample_rate=1.0,
    )


def query_transactions_timeseries(
    transactions: List[Tuple[Project, int | str]],
    start: datetime,
    agg_function: str,
) -> Generator[Tuple[int, Union[int, str], SnubaTSResult], None, None]:
    end = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    days_to_query = options.get("statistical_detectors.query.transactions.timeseries_days")
    start = end - timedelta(days=days_to_query)
    use_case_id = UseCaseID.TRANSACTIONS
    interval = 3600  # 1 hour
    # Snuba allows 10,000 data points per request. 14 days * 1hr * 24hr =
    # 336 data points per transaction name, so we can safely get 25 transaction
    # timeseries.
    chunk_size = 25
    for transaction_chunk in chunked(
        sorted(transactions, key=lambda transaction: (transaction[0].id, transaction[1])),
        chunk_size,
    ):
        project_objects = {p for p, _ in transaction_chunk}
        project_ids = [project.id for project in project_objects]
        org_ids = list({project.organization_id for project in project_objects})
        # The only tag available on DURATION_LIGHT is `transaction`: as long as
        # we don't filter on any other tags, DURATION_LIGHT's lower cardinality
        # will be faster to query.
        duration_metric_id = indexer.resolve(
            use_case_id, org_ids[0], str(TransactionMRI.DURATION_LIGHT.value)
        )
        transaction_name_metric_id = indexer.resolve(
            use_case_id,
            org_ids[0],
            "transaction",
        )

        transactions_condition = None
        if len(transactions) == 1:
            project, transaction_name = transactions[0]
            transactions_condition = BooleanCondition(
                BooleanOp.AND,
                [
                    Condition(Column("project_id"), Op.EQ, project.id),
                    Condition(Column("transaction"), Op.EQ, transaction_name),
                ],
            )
        else:
            transactions_condition = BooleanCondition(
                BooleanOp.OR,
                [
                    BooleanCondition(
                        BooleanOp.AND,
                        [
                            Condition(Column("project_id"), Op.EQ, project.id),
                            Condition(Column("transaction"), Op.EQ, transaction_name),
                        ],
                    )
                    for project, transaction_name in transactions
                ],
            )

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
                    "p95_transaction_duration",
                ),
                Function(
                    "transform",
                    (
                        Column(f"tags_raw[{transaction_name_metric_id}]"),
                        Function("array", ("",)),
                        Function("array", ("<< unparameterized >>",)),
                    ),
                    "transaction",
                ),
            ],
            groupby=[
                Column("transaction"),
                Column("project_id"),
                Function(
                    "toStartOfInterval",
                    (Column("timestamp"), Function("toIntervalSecond", (3600,)), "Universal"),
                    "time",
                ),
            ],
            where=[
                Condition(Column("org_id"), Op.IN, list(org_ids)),
                Condition(Column("project_id"), Op.IN, list(project_ids)),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("metric_id"), Op.EQ, duration_metric_id),
                transactions_condition,
            ],
            orderby=[
                OrderBy(Column("project_id"), Direction.ASC),
                OrderBy(Column("transaction"), Direction.ASC),
                OrderBy(
                    Function(
                        "toStartOfInterval",
                        (Column("timestamp"), Function("toIntervalSecond", (3600,)), "Universal"),
                        "time",
                    ),
                    Direction.ASC,
                ),
            ],
            granularity=Granularity(interval),
            limit=Limit(10000),
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value,
            app_id="statistical_detectors",
            query=query,
            tenant_ids={
                "referrer": Referrer.STATISTICAL_DETECTORS_FETCH_TRANSACTION_TIMESERIES.value,
                "cross_org_query": 1,
                "use_case_id": use_case_id.value,
            },
        )
        data = raw_snql_query(
            request, referrer=Referrer.STATISTICAL_DETECTORS_FETCH_TRANSACTION_TIMESERIES.value
        )["data"]

        results = {}
        for index, datapoint in enumerate(data or []):
            key = (datapoint["project_id"], datapoint["transaction"])
            if key not in results:
                results[key] = {
                    "data": [datapoint],
                }
            else:
                data = results[key]["data"]
                data.append(datapoint)

        for key, item in results.items():
            project_id, transaction_name = key
            formatted_result = SnubaTSResult(
                {
                    "data": zerofill(
                        item["data"],
                        start,
                        end,
                        interval,
                        "time",
                    ),
                    "project": project_id,
                },
                start,
                end,
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

    ratelimit = options.get("statistical_detectors.ratelimit.ema")

    trends = _detect_function_trends(project_ids, start)
    regressions = limit_regressions_by_project(trends, ratelimit)

    delay = 12  # hours
    delayed_start = start + timedelta(hours=delay)

    for regression_chunk in chunked(regressions, FUNCTIONS_PER_BATCH):
        detect_function_change_points.apply_async(
            args=[
                [(payload.project_id, payload.group) for payload in regression_chunk],
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

    breakpoint_count = 0
    emitted_count = 0

    projects_by_id = {
        project.id: project
        for project in Project.objects.filter(
            id__in=[project_id for project_id, _ in functions_list]
        ).select_related("organization")
        if (
            features.has(
                "organizations:profiling-statistical-detectors-breakpoint", project.organization
            )
        )
    }

    breakpoints = _detect_function_change_points(projects_by_id, functions_list, start)

    chunk_size = 100

    for breakpoint_chunk in chunked(breakpoints, chunk_size):
        breakpoint_count += len(breakpoint_chunk)
        emitted_count += emit_function_regression_issue(projects_by_id, breakpoint_chunk, start)

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
) -> Generator[Tuple[Optional[TrendType], float, DetectorPayload], None, None]:
    unique_project_ids: Set[int] = set()

    functions_count = 0
    regressed_count = 0
    improved_count = 0

    detector_config = MovingAverageRelativeChangeDetectorConfig(
        change_metric="statistical_detectors.rel_change.functions",
        min_data_points=6,
        short_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 21),
        long_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 41),
        threshold=0.2,
    )

    detector_store = redis.RedisDetectorStore()

    projects = Project.objects.filter(id__in=project_ids)

    for payloads in chunked(all_function_payloads(projects, start), 100):
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
            trend_type, score = detector.update(payload)

            states.append(None if trend_type is None else detector.state.to_redis_dict())

            if trend_type == TrendType.Regressed:
                regressed_count += 1
            elif trend_type == TrendType.Improved:
                improved_count += 1

            unique_project_ids.add(payload.project_id)

            yield (trend_type, score, payload)

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

    metrics.incr(
        "statistical_detectors.profiling.projects.active",
        amount=len(unique_project_ids),
        sample_rate=1.0,
    )


def _detect_function_change_points(
    projects_by_id: Dict[int, Project],
    functions_pairs: List[Tuple[int, int]],
    start: datetime,
) -> Generator[BreakpointData, None, None]:
    serializer = SnubaTSResultSerializer(None, None, None)

    functions_list: List[Tuple[Project, int]] = [
        (projects_by_id[item[0]], item[1]) for item in functions_pairs if item[0] in projects_by_id
    ]

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
            "min_change()": 100_000_000,  # require a minimum 100ms increase (in ns)
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
            continue


def emit_function_regression_issue(
    projects_by_id: Dict[int, Project],
    breakpoints: List[BreakpointData],
    start: datetime,
) -> int:
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)

    project_ids = [int(entry["project"]) for entry in breakpoints]
    projects = [projects_by_id[project_id] for project_id in project_ids]

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
                "released": features.has(
                    "organizations:profile-function-regression-ingest",
                    project.organization,
                ),
            }
        )

    response = get_from_profiling_service(method="POST", path="/regressed", json_data=payloads)
    if response.status != 200:
        return 0

    data = json.loads(response.data)
    return data.get("occurrences")


def all_function_payloads(
    projects: List[Project],
    start: datetime,
) -> Generator[DetectorPayload, None, None]:
    projects_per_query = options.get("statistical_detectors.query.batch_size")
    assert projects_per_query > 0

    for projects in chunked(projects, projects_per_query):
        try:
            yield from query_functions(projects, start)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            continue


def all_function_timeseries(
    functions_list: List[Tuple[Project, int]],
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


BACKEND_TRANSACTION_OPS = [
    # Common
    "function.aws",
    "function.aws.lambda",
    "http.server",
    "serverless.function",
    # Python
    "asgi.server",
    # Ruby
    "rails.request",
]


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
    #
    # Because we filter on more than just `transaction`, we have to use DURATION here instead of
    # DURATION_LIGHT.
    duration_metric_id = indexer.resolve(
        use_case_id, org_ids[0], str(TransactionMRI.DURATION.value)
    )
    transaction_name_metric_id = indexer.resolve(
        use_case_id,
        org_ids[0],
        "transaction",
    )
    transaction_op_metric_id = indexer.resolve(
        use_case_id,
        org_ids[0],
        "transaction.op",
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
            Condition(
                Column(f"tags_raw[{transaction_op_metric_id}]"),
                Op.IN,
                list(BACKEND_TRANSACTION_OPS),
            ),
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
        dataset=Dataset.PerformanceMetrics.value,
        app_id="statistical_detectors",
        query=query,
        tenant_ids={
            "referrer": Referrer.STATISTICAL_DETECTORS_FETCH_TOP_TRANSACTION_NAMES.value,
            "cross_org_query": 1,
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
    functions_list: List[Tuple[Project, int]],
    start: datetime,
    agg_function: str,
) -> Generator[Tuple[int, int, Any], None, None]:
    projects = [project for project, _ in functions_list]
    project_ids = [project.id for project in projects]

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
            "project.id": project.id,
            "fingerprint": fingerprint,
        }
        for project, fingerprint in functions_list
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

    for project, fingerprint in functions_list:
        key = f"{project.id},{fingerprint}"
        if key not in results:
            logger.warning(
                "Missing timeseries for project: {} function: {}",
                project.id,
                fingerprint,
            )
            continue
        yield project.id, fingerprint, results[key]


def limit_regressions_by_project(
    trends: Generator[Tuple[Optional[TrendType], float, DetectorPayload], None, None],
    ratelimit: int,
) -> Generator[DetectorPayload, None, None]:
    regressions_by_project: DefaultDict[int, List[Tuple[float, DetectorPayload]]] = defaultdict(
        list
    )

    for trend_type, score, payload in trends:
        if trend_type != TrendType.Regressed:
            continue
        heapq.heappush(regressions_by_project[payload.project_id], (score, payload))

        while ratelimit >= 0 and len(regressions_by_project[payload.project_id]) > ratelimit:
            heapq.heappop(regressions_by_project[payload.project_id])

    for regressions in regressions_by_project.values():
        for _, regression in regressions:
            yield regression

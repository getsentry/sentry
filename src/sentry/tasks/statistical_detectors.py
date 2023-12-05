from __future__ import annotations

import heapq
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, DefaultDict, Dict, Generator, Iterable, List, Optional, Tuple

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
from sentry.constants import ObjectStatus
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.profiles.utils import get_from_profiling_service
from sentry.search.events.builder import ProfileTopFunctionsTimeseriesQueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.seer.utils import BreakpointData
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba import functions
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.discover import zerofill
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.statistical_detectors.algorithm import (
    MovingAverageDetectorState,
    MovingAverageRelativeChangeDetector,
    MovingAverageRelativeChangeDetectorConfig,
)
from sentry.statistical_detectors.detector import (
    DetectorPayload,
    DetectorState,
    RegressionDetector,
    TrendType,
)
from sentry.statistical_detectors.issue_platform_adapter import (
    fingerprint_regression,
    send_regression_to_platform,
)
from sentry.statistical_detectors.redis import DetectorType, RedisDetectorStore
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


def get_performance_issue_settings(projects: List[Project]):
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

    for project_id, flags in RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE).values_list("id", "flags"),
        result_value_getter=lambda item: item[0],
    ):
        if flags & Project.flags.has_transactions:
            performance_projects.append(project_id)
            performance_projects_count += 1

            if len(performance_projects) >= PROJECTS_PER_BATCH:
                detect_transaction_trends.delay(
                    [],
                    performance_projects,
                    now,
                )
                performance_projects = []

        if flags & Project.flags.has_profiles:
            profiling_projects.append(project_id)
            profiling_projects_count += 1

            if len(profiling_projects) >= PROJECTS_PER_BATCH:
                detect_function_trends.delay(profiling_projects, now)
                profiling_projects = []

    # make sure to dispatch a task to handle the remaining projects
    if performance_projects:
        detect_transaction_trends.delay(
            [],
            performance_projects,
            now,
        )
    if profiling_projects:
        detect_function_trends.delay(profiling_projects, now)

    metrics.incr(
        "statistical_detectors.projects.total",
        amount=performance_projects_count,
        tags={"source": "transaction"},
        sample_rate=1.0,
    )

    metrics.incr(
        "statistical_detectors.projects.total",
        amount=profiling_projects_count,
        tags={"source": "profile"},
        sample_rate=1.0,
    )


class EndpointRegressionDetector(RegressionDetector):
    source = "transaction"
    kind = "endpoint"
    config = MovingAverageRelativeChangeDetectorConfig(
        min_data_points=6,
        short_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 21),
        long_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 41),
        threshold=0.2,
    )
    store = RedisDetectorStore(detector_type=DetectorType.ENDPOINT)  # e for endpoint
    state_cls = MovingAverageDetectorState
    detector_cls = MovingAverageRelativeChangeDetector
    min_change = 200  # 200ms in ms

    @classmethod
    def query_payloads(
        cls,
        projects: List[Project],
        start: datetime,
    ) -> Iterable[DetectorPayload]:
        return query_transactions(projects, start)

    @classmethod
    def query_timeseries(
        cls,
        objects: List[Tuple[Project, int | str]],
        start: datetime,
        function: str,
    ) -> Iterable[Tuple[int, int | str, SnubaTSResult]]:
        return query_transactions_timeseries(objects, start, function)


class FunctionRegressionDetector(RegressionDetector):
    source = "profile"
    kind = "function"
    config = MovingAverageRelativeChangeDetectorConfig(
        min_data_points=6,
        short_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 21),
        long_moving_avg_factory=lambda: ExponentialMovingAverage(2 / 41),
        threshold=0.2,
    )
    store = RedisDetectorStore(detector_type=DetectorType.FUNCTION)
    state_cls = MovingAverageDetectorState
    detector_cls = MovingAverageRelativeChangeDetector
    min_change = 100_000_000  # 100ms in ns

    @classmethod
    def query_payloads(
        cls,
        projects: List[Project],
        start: datetime,
    ) -> List[DetectorPayload]:
        return query_functions(projects, start)

    @classmethod
    def query_timeseries(
        cls,
        objects: List[Tuple[Project, int | str]],
        start: datetime,
        function: str,
    ) -> Iterable[Tuple[int, int | str, SnubaTSResult]]:
        return query_functions_timeseries(objects, start, function)


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_transaction_trends",
    queue="performance.statistical_detector",
    max_retries=0,
)
def detect_transaction_trends(
    _org_ids: List[int], project_ids: List[int], start: datetime, *args, **kwargs
) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    projects = get_detector_enabled_projects(
        project_ids,
        feature_name="organizations:performance-statistical-detectors-ema",
        project_option=InternalProjectOptions.TRANSACTION_DURATION_REGRESSION,
    )

    ratelimit = options.get("statistical_detectors.ratelimit.ema")
    trends = EndpointRegressionDetector.detect_trends(projects, start)
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
        for project in get_detector_enabled_projects(
            [project_id for project_id, _ in transactions],
            feature_name="organizations:performance-statistical-detectors-breakpoint",
        )
    }

    transaction_pairs: List[Tuple[Project, int | str]] = [
        (projects_by_id[item[0]], item[1]) for item in transactions if item[0] in projects_by_id
    ]

    breakpoint_count = 0

    regressions = EndpointRegressionDetector.detect_regressions(
        transaction_pairs, start, "p95(transaction.duration)", TIMESERIES_PER_BATCH
    )

    for regression in regressions:
        breakpoint_count += 1
        send_regression_to_platform(regression, True)

    metrics.incr(
        "statistical_detectors.breakpoint.emitted",
        amount=breakpoint_count,
        tags={"source": "transaction", "kind": "endpoint"},
        sample_rate=1.0,
    )


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_function_trends",
    queue="profiling.statistical_detector",
    max_retries=0,
)
def detect_function_trends(project_ids: List[int], start: datetime, *args, **kwargs) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    projects = get_detector_enabled_projects(
        project_ids,
        feature_name="organizations:profiling-statistical-detectors-ema",
    )

    ratelimit = options.get("statistical_detectors.ratelimit.ema")
    trends = FunctionRegressionDetector.detect_trends(projects, start)
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

    projects_by_id = {
        project.id: project
        for project in get_detector_enabled_projects(
            [project_id for project_id, _ in functions_list],
            feature_name="organizations:profiling-statistical-detectors-breakpoint",
        )
    }

    function_pairs: List[Tuple[Project, int | str]] = [
        (projects_by_id[item[0]], item[1]) for item in functions_list if item[0] in projects_by_id
    ]

    breakpoint_count = 0
    emitted_count = 0

    regressions = FunctionRegressionDetector.detect_regressions(
        function_pairs, start, "p95()", TIMESERIES_PER_BATCH
    )

    for regression_chunk in chunked(regressions, 100):
        breakpoint_count += len(regression_chunk)
        emitted_count += emit_function_regression_issue(projects_by_id, regression_chunk, start)

    metrics.incr(
        "statistical_detectors.breakpoint.detected",
        amount=breakpoint_count,
        tags={"source": "profile", "kind": "function"},
        sample_rate=1.0,
    )

    metrics.incr(
        "statistical_detectors.breakpoint.emitted",
        amount=emitted_count,
        tags={"source": "profile", "kind": "function"},
        sample_rate=1.0,
    )


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
                "released": True,
            }
        )

    response = get_from_profiling_service(method="POST", path="/regressed", json_data=payloads)
    if response.status != 200:
        return 0

    data = json.loads(response.data)
    return data.get("occurrences")


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
    projects: List[Project],
    start: datetime,
    transactions_per_project: int = TRANSACTIONS_PER_PROJECT,
) -> List[DetectorPayload]:
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)

    org_ids = list({p.organization_id for p in projects})
    project_ids = list({p.id for p in projects})

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
            Condition(Column("project_id"), Op.IN, project_ids),
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
            # take the first 16 chars of the fingerprint as that's sufficiently unique
            fingerprint=fingerprint_regression(row["transaction_name"])[:16],
            count=row["count"],
            value=row["p95"],
            timestamp=start,
        )
        for row in data
    ]


def query_transactions_timeseries(
    transactions: List[Tuple[Project, int | str]],
    start: datetime,
    agg_function: str,
) -> Generator[Tuple[int, int | str, SnubaTSResult], None, None]:
    end = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    days_to_query = options.get("statistical_detectors.query.transactions.timeseries_days")
    start = end - timedelta(days=days_to_query)
    use_case_id = UseCaseID.TRANSACTIONS
    interval = 3600  # 1 hour

    project_objects = {p for p, _ in transactions}
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
            fingerprint=row["fingerprint"],
            count=row["count()"],
            value=row["p95()"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
        )
        for row in query_results["data"]
    ]


def query_functions_timeseries(
    functions_list: List[Tuple[Project, int | str]],
    start: datetime,
    agg_function: str,
) -> Generator[Tuple[int, int | str, SnubaTSResult], None, None]:
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


def get_detector_enabled_projects(
    project_ids: List[int],
    feature_name: str | None = None,
    project_option: InternalProjectOptions | None = None,
) -> List[Project]:
    projects = Project.objects.filter(id__in=project_ids)

    if feature_name is None:
        projects = [project for project in projects]
    else:
        projects = [
            project
            for project in projects.select_related("organization")
            if features.has(feature_name, project.organization)
        ]

    if project_option is not None:
        settings = get_performance_issue_settings(projects)
        projects = [project for project in projects if settings[project][project_option.value]]

    return projects


def limit_regressions_by_project(
    trends: Generator[
        Tuple[Optional[TrendType], float, DetectorPayload, DetectorState], None, None
    ],
    ratelimit: int,
) -> Generator[DetectorPayload, None, None]:
    regressions_by_project: DefaultDict[int, List[Tuple[float, DetectorPayload]]] = defaultdict(
        list
    )

    for trend_type, score, payload, state in trends:
        if trend_type != TrendType.Regressed:
            continue
        heapq.heappush(regressions_by_project[payload.project_id], (score, payload))

        while ratelimit >= 0 and len(regressions_by_project[payload.project_id]) > ratelimit:
            heapq.heappop(regressions_by_project[payload.project_id])

    for regressions in regressions_by_project.values():
        for _, regression in regressions:
            yield regression

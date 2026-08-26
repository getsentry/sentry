from __future__ import annotations

import logging
from collections.abc import Generator, Iterable
from datetime import UTC, datetime, timedelta
from typing import Any

from django.utils import timezone as django_timezone
from snuba_sdk import (
    And,
    BooleanCondition,
    Column,
    Condition,
    Limit,
    Op,
    Or,
    Query,
    Request,
    Storage,
)

from sentry import features, options, projectoptions
from sentry.constants import ObjectStatus
from sentry.issues.endpoints.project_performance_issue_settings import InternalProjectOptions
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.statistical_detectors import RegressionType
from sentry.profiles.utils import get_from_profiling_service
from sentry.search.events.fields import resolve_datetime64
from sentry.search.events.types import SnubaParams
from sentry.seer.breakpoints import BreakpointData
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.snuba import functions
from sentry.snuba.dataset import Dataset, StorageKey
from sentry.snuba.referrer import Referrer
from sentry.statistical_detectors.algorithm import (
    DetectorAlgorithm,
    MovingAverageRelativeChangeDetector,
)
from sentry.statistical_detectors.base import DetectorPayload
from sentry.statistical_detectors.detector import RegressionDetector
from sentry.statistical_detectors.redis import RedisDetectorStore
from sentry.statistical_detectors.store import DetectorStore
from sentry.tasks.base import instrumented_task
from sentry.tasks.utils import compute_delay
from sentry.taskworker.namespaces import performance_tasks, profiling_tasks
from sentry.utils import json, metrics
from sentry.utils.iterators import chunked
from sentry.utils.math import ExponentialMovingAverage
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import SnubaTSResult, raw_snql_query

logger = logging.getLogger("sentry.tasks.statistical_detectors")


FUNCTIONS_PER_PROJECT = 50
FUNCTIONS_PER_BATCH = 1_000
PROJECTS_PER_BATCH = 1_000
TIMESERIES_PER_BATCH = 10


def get_performance_issue_settings(projects: list[Project]):
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


def all_projects_with_flags() -> Generator[tuple[int, int]]:
    yield from RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE).values_list("id", "flags"),
        result_value_getter=lambda item: item[0],
    )


@instrumented_task(
    name="sentry.tasks.statistical_detectors.run_detection",
    namespace=performance_tasks,
    processing_deadline_duration=30,
)
def run_detection() -> None:
    if not options.get("statistical_detectors.enable"):
        return

    now = django_timezone.now()

    projects = all_projects_with_flags()
    projects = dispatch_profiling_projects(projects, now)

    # make sure to consume the generator
    for _ in projects:
        pass


def dispatch_profiling_projects(
    all_projects: Generator[tuple[int, int]],
    timestamp: datetime,
) -> Generator[tuple[int, int]]:
    projects = []
    count = 0

    for project_id, flags in all_projects:
        if flags & Project.flags.has_profiles:
            projects.append(project_id)
            count += 1

        if len(projects) >= PROJECTS_PER_BATCH:
            detect_function_trends.apply_async(
                args=[projects, timestamp.isoformat()],
                countdown=compute_delay(timestamp, (count - 1) // PROJECTS_PER_BATCH),
            )
            projects = []

        yield project_id, flags

    # make sure to dispatch a task to handle the remaining projects
    if projects:
        detect_function_trends.apply_async(
            args=[projects, timestamp.isoformat()],
            countdown=compute_delay(timestamp, (count - 1) // PROJECTS_PER_BATCH),
        )

    metrics.incr(
        "statistical_detectors.projects.total",
        amount=count,
        tags={"source": "profile"},
        sample_rate=1.0,
    )


class FunctionRegressionDetector(RegressionDetector):
    source = "profile"
    kind = "function"
    regression_type = RegressionType.FUNCTION
    min_change = 100_000_000  # 100ms in ns
    buffer_period = timedelta(days=1)
    resolution_rel_threshold = 0.1
    escalation_rel_threshold = 0.75

    @classmethod
    def min_throughput_threshold(cls) -> int:
        return options.get("statistical_detectors.throughput.threshold.functions")

    @classmethod
    def detector_algorithm_factory(cls) -> DetectorAlgorithm:
        return MovingAverageRelativeChangeDetector(
            source=cls.source,
            kind=cls.kind,
            min_data_points=18,
            moving_avg_short_factory=lambda: ExponentialMovingAverage(2 / 21),
            moving_avg_long_factory=lambda: ExponentialMovingAverage(2 / 41),
            threshold=0.15,
        )

    @classmethod
    def detector_store_factory(cls) -> DetectorStore:
        return RedisDetectorStore(regression_type=RegressionType.FUNCTION)

    @classmethod
    def query_payloads(
        cls,
        projects: list[Project],
        start: datetime,
    ) -> list[DetectorPayload]:
        return query_functions(projects, start)

    @classmethod
    def query_timeseries(
        cls,
        objects: list[tuple[Project, int | str]],
        start: datetime,
        function: str,
    ) -> Iterable[tuple[int, int | str, SnubaTSResult]]:
        return query_functions_timeseries(objects, start, function)


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_function_trends",
    namespace=profiling_tasks,
    processing_deadline_duration=30,
)
def detect_function_trends(project_ids: list[int], start: str, *args, **kwargs) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    start_time = datetime.fromisoformat(start)

    FunctionRegressionDetector.configure_tags()

    projects = get_detector_enabled_projects(
        project_ids,
        project_option=InternalProjectOptions.FUNCTION_DURATION_REGRESSION,
    )

    trends = FunctionRegressionDetector.detect_trends(projects, start_time)
    trends = FunctionRegressionDetector.get_regression_groups(trends)
    trends = FunctionRegressionDetector.redirect_resolutions(trends, start_time)
    trends = FunctionRegressionDetector.redirect_escalations(trends, start_time)
    trends = FunctionRegressionDetector.limit_regressions_by_project(trends)

    delay = 12  # hours
    delayed_start = start_time + timedelta(hours=delay)

    for regression_chunk in chunked(trends, FUNCTIONS_PER_BATCH):
        detect_function_change_points.apply_async(
            args=[
                [(bundle.payload.project_id, bundle.payload.group) for bundle in regression_chunk],
                delayed_start.isoformat(),
            ],
            # delay the check by delay hours because we want to make sure there
            # will be enough data after the potential change point to be confident
            # that a change has occurred
            countdown=delay * 60 * 60,
        )


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_function_change_points",
    namespace=profiling_tasks,
)
def detect_function_change_points(
    functions_list: list[tuple[int, int]], start: str, *args, **kwargs
) -> None:
    start_time = datetime.fromisoformat(start)

    _detect_function_change_points(functions_list, start_time, *args, **kwargs)


def _detect_function_change_points(
    functions_list: list[tuple[int, int]], start: datetime, *args, **kwargs
) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    FunctionRegressionDetector.configure_tags()

    projects_by_id = {
        project.id: project
        for project in get_detector_enabled_projects(
            [project_id for project_id, _ in functions_list],
        )
    }

    function_pairs: list[tuple[Project, int | str]] = [
        (projects_by_id[item[0]], item[1]) for item in functions_list if item[0] in projects_by_id
    ]

    viewer_context = None
    if function_pairs:
        project = function_pairs[0][0]
        viewer_context = SeerViewerContext(organization_id=project.organization_id)

    regressions = FunctionRegressionDetector.detect_regressions(
        function_pairs, start, "p95()", TIMESERIES_PER_BATCH, viewer_context=viewer_context
    )
    regressions = FunctionRegressionDetector.save_regressions_with_versions(regressions)

    breakpoint_count = 0
    emitted_count = 0

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
    projects_by_id: dict[int, Project],
    regressions: list[BreakpointData],
    start: datetime,
) -> int:
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)

    project_ids = [int(regression["project"]) for regression in regressions]
    projects = [projects_by_id[project_id] for project_id in project_ids]

    params = SnubaParams(
        start=start,
        end=start + timedelta(minutes=1),
        projects=projects,
    )

    conditions = [
        And(
            [
                Condition(Column("project_id"), Op.EQ, int(regression["project"])),
                Condition(Column("fingerprint"), Op.EQ, int(regression["transaction"])),
            ]
        )
        for regression in regressions
    ]

    result = functions.query(
        selected_columns=["project.id", "fingerprint", "all_examples()"],
        query="is_application:1",
        snuba_params=params,
        orderby=["project.id"],
        limit=len(regressions),
        referrer=Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_EXAMPLE.value,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        transform_alias_to_input_format=True,
        conditions=conditions if len(conditions) <= 1 else [Or(conditions)],
    )

    transaction_examples = {}
    raw_continuous_examples = {}
    for row in result["data"]:
        # Split this into 2 loops here to bias towards transaction based profiles

        key = (row["project.id"], row["fingerprint"])
        for example in row["all_examples()"]:
            if "profile_id" in example:
                transaction_examples[key] = example

        if key in transaction_examples:
            continue

        for example in row["all_examples()"]:
            if "profiler_id" in example:
                raw_continuous_examples[key] = example

    continuous_examples = fetch_continuous_examples(raw_continuous_examples)

    payloads = []

    for regression in regressions:
        project_id = int(regression["project"])
        fingerprint = int(regression["transaction"])

        project = projects_by_id.get(project_id)
        if project is None:
            continue

        key = (project_id, fingerprint)
        example = transaction_examples.get(key) or continuous_examples.get(key)

        if example is None:
            continue

        payloads.append(
            {
                "organization_id": project.organization_id,
                "project_id": project_id,
                "example": example,
                "fingerprint": fingerprint,
                "absolute_percentage_change": regression["absolute_percentage_change"],
                "aggregate_range_1": regression["aggregate_range_1"],
                "aggregate_range_2": regression["aggregate_range_2"],
                "breakpoint": int(regression["breakpoint"]),
                "trend_difference": regression["trend_difference"],
                "trend_percentage": regression["trend_percentage"],
                "unweighted_p_value": regression["unweighted_p_value"],
                "unweighted_t_value": regression["unweighted_t_value"],
            }
        )

    if not payloads:
        return 0

    response = get_from_profiling_service(method="POST", path="/regressed", json_data=payloads)
    if response.status != 200:
        return 0

    data = json.loads(response.data)
    return data.get("occurrences")


def fetch_continuous_examples(raw_examples):
    if not raw_examples:
        return raw_examples

    project_condition = Condition(
        Column("project_id"),
        Op.IN,
        list({project_id for project_id, _ in raw_examples.keys()}),
    )

    conditions = [project_condition]

    example_conditions: list[BooleanCondition | Condition] = []

    for (project_id, _), example in raw_examples.items():
        example_conditions.append(
            And(
                [
                    Condition(Column("project_id"), Op.EQ, project_id),
                    Condition(Column("profiler_id"), Op.EQ, example["profiler_id"]),
                    Condition(
                        Column("start_timestamp"), Op.LTE, resolve_datetime64(example["end"])
                    ),
                    Condition(
                        Column("end_timestamp"), Op.GTE, resolve_datetime64(example["start"])
                    ),
                ]
            )
        )

    if len(example_conditions) >= 2:
        conditions.append(Or(example_conditions))
    else:
        conditions.extend(example_conditions)

    query = Query(
        match=Storage(StorageKey.ProfileChunks.value),
        select=[
            Column("project_id"),
            Column("profiler_id"),
            Column("chunk_id"),
            Column("start_timestamp"),
            Column("end_timestamp"),
        ],
        where=conditions,
        limit=Limit(len(raw_examples)),
    )

    request = Request(
        dataset=Dataset.Profiles.value,
        app_id="default",
        query=query,
        tenant_ids={
            "referrer": Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_CHUNKS.value,
            "cross_org_query": 1,
        },
    )

    data = raw_snql_query(
        request,
        referrer=Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_CHUNKS.value,
    )["data"]

    for row in data:
        row["start"] = (
            datetime.fromisoformat(row["start_timestamp"]).replace(tzinfo=UTC).timestamp()
        )
        row["end"] = datetime.fromisoformat(row["end_timestamp"]).replace(tzinfo=UTC).timestamp()

    examples = {}

    for key, example in raw_examples.items():
        for row in data:
            if example["profiler_id"] != row["profiler_id"]:
                continue
            if example["start"] > row["end"]:
                continue
            if example["end"] < row["start"]:
                continue
            examples[key] = {
                "profiler_id": row["profiler_id"],
                "chunk_id": row["chunk_id"],
                "thread_id": example["thread_id"],
                "start": row["start"],
                "end": row["end"],
            }

    return examples


def query_functions(projects: list[Project], start: datetime) -> list[DetectorPayload]:
    # The functions dataset only supports 1 hour granularity.
    # So we always look back at the last full hour that just elapsed.
    # And since the timestamps are truncated to the start of the hour
    # we just need to query for the 1 minute of data.
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)
    params = SnubaParams(
        start=start,
        end=start + timedelta(minutes=1),
        projects=projects,
    )

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
        snuba_params=params,
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
            fingerprint=f"{row['fingerprint']:x}",
            count=row["count()"],
            value=row["p95()"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
        )
        for row in query_results["data"]
    ]


def query_functions_timeseries(
    functions_list: list[tuple[Project, int | str]],
    start: datetime,
    agg_function: str,
) -> Generator[tuple[int, int | str, SnubaTSResult]]:
    projects = [project for project, _ in functions_list]

    days_to_query = options.get("statistical_detectors.query.functions.timeseries_days")
    end = start.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    params = SnubaParams(
        start=end - timedelta(days=days_to_query),
        end=end,
        projects=projects,
    )
    interval = 3600  # 1 hour

    chunk: list[dict[str, Any]] = [
        {
            "project.id": project.id,
            "fingerprint": fingerprint,
        }
        for project, fingerprint in functions_list
    ]

    results = functions.top_events_timeseries(
        timeseries_columns=[agg_function],
        selected_columns=["project.id", "fingerprint"],
        user_query="is_application:1",
        snuba_params=params,
        orderby=None,  # unused because top events is specified
        rollup=interval,
        limit=len(chunk),
        organization=None,  # unused
        referrer=Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR_STATS.value,
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
    project_ids: list[int],
    feature_name: str | None = None,
    project_option: InternalProjectOptions | None = None,
) -> list[Project]:
    projects_qs = Project.objects.filter(id__in=project_ids)

    if feature_name is None:
        projects = list(projects_qs)
    else:
        projects = [
            project
            for project in projects_qs.select_related("organization")
            if features.has(feature_name, project.organization)
        ]

    if project_option is not None:
        settings = get_performance_issue_settings(projects)
        projects = [project for project in projects if settings[project][project_option.value]]

    return projects

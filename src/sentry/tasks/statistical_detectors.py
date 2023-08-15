import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List

import sentry_sdk
from django.utils import timezone

from sentry import options
from sentry.models.project import Project
from sentry.snuba import functions
from sentry.snuba.referrer import Referrer
from sentry.statistical_detectors.detector import TrendPayload
from sentry.tasks.base import instrumented_task
from sentry.utils.iterators import chunked

logger = logging.getLogger("sentry.tasks.statistical_detectors")


FUNCTIONS_PER_PROJECT = 100

ITERATOR_CHUNK = 1_000


@instrumented_task(
    name="sentry.tasks.statistical_detectors.run_detection",
    queue="performance.statistical_detector",
    max_retries=0,
)
def run_detection() -> None:
    if not options.get("statistical_detectors.enable"):
        return

    now = timezone.now()

    performance_projects: List[int] = options.get(
        "statistical_detectors.enable.projects.performance"
    )
    profiling_projects: List[int] = options.get("statistical_detectors.enable.projects.profiling")

    """ disabled for now so we can run experiements
    for project in RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE),
        result_value_getter=lambda item: item.id,
        step=ITERATOR_CHUNK,
    ):
        if project.flags.has_transactions:
            performance_projects.append(project.id)

            if len(performance_projects) >= ITERATOR_CHUNK:
                detect_transaction_trends.delay(performance_projects)
                performance_projects = []

        if project.flags.has_profiles:
            profiling_projects.append(project.id)

            if len(profiling_projects) >= ITERATOR_CHUNK:
                detect_function_trends.delay(profiling_projects, now)
                profiling_projects = []
    """

    # make sure to dispatch a task to handle the remaining projects
    if performance_projects:
        detect_transaction_trends.delay(performance_projects)
        performance_projects = []
    if profiling_projects:
        detect_function_trends.delay(profiling_projects, now)
        profiling_projects = []


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_transaction_trends",
    queue="performance.statistical_detector",
    max_retries=0,
)
def detect_transaction_trends(project_ids: List[int], **kwargs) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    for project_id in project_ids:
        query_transactions(project_id)


@instrumented_task(
    name="sentry.tasks.statistical_detectors.detect_function_trends",
    queue="profiling.statistical_detector",
    max_retries=0,
)
def detect_function_trends(project_ids: List[int], start: datetime, **kwargs) -> None:
    if not options.get("statistical_detectors.enable"):
        return

    projects_per_query = options.get("statistical_detectors.query.batch_size")
    assert projects_per_query > 0

    for projects in chunked(Project.objects.filter(id__in=project_ids), projects_per_query):
        try:
            query_functions(projects, start)
        except Exception as e:
            sentry_sdk.capture_exception(e)


def query_transactions(project_id: int) -> None:
    pass


def query_functions(projects: List[Project], start: datetime) -> Dict[int, List[TrendPayload]]:
    params = _get_function_query_params(projects, start)

    # TODOs:
    # - format and return this for further processing
    # - handle any errors
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

    function_results = defaultdict(list)
    for row in query_results["data"]:
        payload = TrendPayload(
            group=row["fingerprint"],
            count=row["count()"],
            value=row["p95()"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
        )
        function_results[row["project.id"]].append(payload)

    return function_results


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

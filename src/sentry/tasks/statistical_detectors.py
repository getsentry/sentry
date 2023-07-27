import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.models import Project
from sentry.snuba import functions
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.statistical_detectors")


ITERATOR_CHUNK = 10_000


@instrumented_task(
    name="sentry.tasks.statistical_detectors.run_detection",
    queue="performance.statistical_detector",
    max_retries=0,
)
def run_detection() -> None:
    now = timezone.now()

    performance_projects = []
    profiling_projects = []

    # TODO: iterate over a predefined list of projects for testing
    for project in RangeQuerySetWrapper(
        Project.objects.filter(status=ObjectStatus.ACTIVE),
        result_value_getter=lambda item: item.id,
        step=ITERATOR_CHUNK,
    ):
        if project.flags.has_transactions:
            performance_projects.append(project.id)

            if len(performance_projects) >= ITERATOR_CHUNK:
                detect_regressed_transactions.delay(performance_projects)
                performance_projects = []

        if project.flags.has_profiles:
            profiling_projects.append(project.id)

            if len(profiling_projects) >= ITERATOR_CHUNK:
                detect_regressed_functions.delay(profiling_projects, now)
                profiling_projects = []

    # make sure to dispatch a task to handle the remaining projects
    if performance_projects:
        detect_regressed_transactions.delay(performance_projects)
        performance_projects = []
    if profiling_projects:
        detect_regressed_functions.delay(profiling_projects, now)
        profiling_projects = []


@instrumented_task(
    name="sentry.tasks.statistical_detectors._detect_regressed_transactions",
    queue="performance.statistical_detector",
    max_retries=0,
)
def detect_regressed_transactions(project_ids: List[int], **kwargs) -> None:
    for project_id in project_ids:
        _detect_regressed_transactions(project_id)


@instrumented_task(
    name="sentry.tasks.statistical_detectors._detect_regressed_functions",
    queue="performance.statistical_detector",
    max_retries=0,
)
def detect_regressed_functions(project_ids: List[int], start: datetime, **kwargs) -> None:

    for project in Project.objects.filter(id__in=project_ids):
        _detect_regressed_functions(project, start)


def _detect_regressed_transactions(project_id: int) -> None:
    pass


def _detect_regressed_functions(project: Project, start: datetime) -> None:
    params = _get_regressed_function_query_params(project, start)

    functions.query(
        selected_columns=[
            "fingerprint",
            "count()",
            "p95()",
        ],
        query="is_application:1",
        params=params,
        orderby=["-count()"],
        limit=100,
        referrer=Referrer.API_PROFILING_FUNCTIONS_STATISTICAL_DETECTOR.value,
        auto_aggregations=True,
        use_aggregate_conditions=True,
        transform_alias_to_input_format=True,
    )


def _get_regressed_function_query_params(project: Project, start: datetime) -> Dict[str, Any]:
    # The functions dataset only supports 1 hour granularity.
    # So we always look back at the last full hour that just elapsed.
    start = start - timedelta(hours=1)
    start = start.replace(minute=0, second=0, microsecond=0)

    return {
        "start": start,
        "end": start + timedelta(minutes=1),
        "project_id": [project.id],
        "project_objects": [project],
        "organization_id": project.organization_id,
    }

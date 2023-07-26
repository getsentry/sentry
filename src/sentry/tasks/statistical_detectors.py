import logging
from typing import List

from sentry.constants import ObjectStatus
from sentry.models import Project
from sentry.tasks.base import instrumented_task
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.statistical_detectors")


ITERATOR_CHUNK = 10_000


@instrumented_task(
    name="sentry.tasks.statistical_detectors.run_detection",
    queue="performance.statistical_detector",
    max_retries=0,
)
def run_detection() -> None:
    # TODO: iterate over a predefined list of projects for testing
    for project_ids in chunked(
        RangeQuerySetWrapper(
            Project.objects.filter(status=ObjectStatus.ACTIVE).values_list("id", flat=True),
            result_value_getter=lambda item: item,
            step=ITERATOR_CHUNK,
        ),
        ITERATOR_CHUNK,
    ):
        _detect_regressed_transactions(project_ids)
        _detect_regressed_functions(project_ids)


@instrumented_task(
    name="sentry.tasks.statistical_detectors._detect_regressed_transactions",
    queue="performance.statistical_detector",
    max_retries=0,
)
def _detect_regressed_transactions(project_ids: List[int]) -> None:
    logger.info("running transaction regression detection", extra={"projects": project_ids})


@instrumented_task(
    name="sentry.tasks.statistical_detectors._detect_regressed_functions",
    queue="performance.statistical_detector",
    max_retries=0,
)
def _detect_regressed_functions(project_ids: List[int]) -> None:
    logger.info("running function regression detection", extra={"projects": project_ids})

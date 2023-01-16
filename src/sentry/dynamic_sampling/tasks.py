import logging

from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.tasks.base import instrumented_task

CHUNK_SIZE = 1000
MAX_SECONDS = 60

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.prioritise_projects",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def prioritise_projects(**kwargs) -> None:
    for org_id, project_ids in fetch_projects_with_total_volumes().items():
        process_projects_sample_rates.delay(org_id, project_ids)


@instrumented_task(
    name="sentry.dynamic_sampling.process_projects_sample_rates",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def process_projects_sample_rates(org_id, project_ids) -> None:
    """
    Takes a single org id and a list of project ids
    """
    ...

    # Get adjusted sample rate via adjustment model
    #
    # prioritize_projects.delay(org_id, project_ids)

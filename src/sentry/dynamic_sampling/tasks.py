import logging

from sentry import features
from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.adjustment_models import Project as DSProject
from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.models import Organization
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

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
    metrics.incr("sentry.tasks.dynamic_sampling.prioritise_projects.start", sample_rate=1.0)
    with metrics.timer("sentry.tasks.dynamic_sampling.prioritise_projects", sample_rate=1.0):
        for org_id, project_id_with_count_per_root in fetch_projects_with_total_volumes().items():
            process_projects_sample_rates.delay(org_id, project_id_with_count_per_root)


@instrumented_task(
    name="sentry.dynamic_sampling.process_projects_sample_rates",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def process_projects_sample_rates(organization_id, project_id_with_count_per_root) -> None:
    """
    Takes a single org id and a list of project ids
    """
    organization = Organization.objects.get_from_cache(id=organization_id)
    # Check if feature flag is enabled:
    if features.has("organizations:ds-prioritise-by-project-bias", organization):
        with metrics.timer("sentry.tasks.dynamic_sampling.process_projects_sample_rates.core"):
            adjust_sample_rates(organization_id, project_id_with_count_per_root)


def adjust_sample_rates(org_id, project_id_with_count_per_root):
    projects = []
    for project_id, count_per_root in project_id_with_count_per_root:
        projects.append(
            DSProject(id=project_id, count_per_root=count_per_root, blended_sample_rate=0.0)
        )
    model = AdjustedModel(projects=projects)
    new_rates = model.adjust_sample_rates()
    _ = new_rates

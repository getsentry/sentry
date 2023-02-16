import logging
from typing import Any, Mapping, Sequence

from django.conf import settings

from sentry import features
from sentry.dynamic_sampling.models.adjustment_models import AdjustedModel
from sentry.dynamic_sampling.models.adjustment_models import Project as DSProject
from sentry.dynamic_sampling.prioritise_projects import fetch_projects_with_total_volumes
from sentry.models import Organization
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils import metrics, redis

CHUNK_SIZE = 1000
MAX_SECONDS = 60

logger = logging.getLogger(__name__)

REDIS_KEY_TEMPLATE = "ds::b:o:{org_id}:p:{project_id}:"


def get_redis_client_for_ds() -> Any:
    cluster_key = getattr(settings, "SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def _generate_cache_key_for_prioritise_projects_bias(org_id, project_id) -> str:
    return f"ds::o:{org_id}:p:{project_id}:prioritise_projects"


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.prioritise_projects",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def prioritise_projects() -> None:
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
def process_projects_sample_rates(
    organization_id: int, project_id_with_count_per_root: Sequence[Mapping[int, int]]
) -> None:
    """
    Takes a single org id and a list of project ids
    """
    organization = Organization.objects.get_from_cache(id=organization_id)
    # Check if feature flag is enabled:
    if features.has("organizations:ds-prioritise-by-project-bias", organization):
        with metrics.timer("sentry.tasks.dynamic_sampling.process_projects_sample_rates.core"):
            adjust_sample_rates(organization_id, project_id_with_count_per_root)


def adjust_sample_rates(
    org_id: int, project_id_with_count_per_root: Sequence[Mapping[int, int]]
) -> None:
    """
    This function apply model and adjust sample rate per project in org
    and store it in DS redis cluster, then we invalidate project config
    so relay can reread it, and we'll inject it from redis cache.
    """
    projects = []
    for project_id, count_per_root in project_id_with_count_per_root:
        projects.append(
            DSProject(id=project_id, count_per_root=count_per_root, blended_sample_rate=0.0)
        )
    model = AdjustedModel(projects=projects)
    ds_projects = model.adjust_sample_rates()

    redis_client = get_redis_client_for_ds()
    for ds_project in ds_projects:
        # TODO: Check that sample rate between 0 < sample_rate < 1.0
        # hash, key, value
        redis_client.set(
            _generate_cache_key_for_prioritise_projects_bias(
                project_id=ds_project.id, org_id=org_id
            ),
            ds_project.new_sample_rate,  # redis stores is as string
            60 * 60 * 24,
        )
        schedule_invalidate_project_config(
            project_id=ds_project.id, trigger="dynamic_sampling_prioritise_project_bias"
        )

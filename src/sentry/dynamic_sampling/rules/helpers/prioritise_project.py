from typing import TYPE_CHECKING

from sentry.dynamic_sampling.rules.helpers.utils import get_redis_client_for_ds

if TYPE_CHECKING:
    from sentry.models import Project


def _generate_cache_key(org_id, project_id) -> str:
    return f"ds::o:{org_id}:p:{project_id}:prioritise_projects"


def get_cached_sample_rate(project: "Project", default_samplerate=None):
    """
    This function returns cached sample rate from prioritise by project
    celery task or fallback to None
    """
    redis_client = get_redis_client_for_ds()
    cache_key = _generate_cache_key(project.organization.id, project.id)
    cached_sample_rate = redis_client.get(name=cache_key)
    return cached_sample_rate if cached_sample_rate else default_samplerate

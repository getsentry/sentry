from typing import Literal

from django.db.models import Q

from sentry.models.environment import Environment
from sentry.utils.cache import cache
from sentry.workflow_engine.models import Detector, DetectorWorkflow, Workflow
from sentry.workflow_engine.utils.metrics import metrics_incr

# Cache timeout for 1 minute
CACHE_TTL = 60  # TODO - Increase TTL once we confirm everything
METRIC_PREFIX = "workflow_engine.cache.processing_workflow"

DEFAULT_VALUE = "default"
WORKFLOW_CACHE_PREFIX = "workflows_by_detector_env"


# TODO - make the keys here safer with CacheAccess[T]
def processing_workflow_cache_key(detector_id: int, env_id: int | None = None) -> str:
    return f"{WORKFLOW_CACHE_PREFIX}:{detector_id}:{env_id}"


def invalidate_processing_workflows(
    detector_id: int, env_id: int | None | Literal["default"] = DEFAULT_VALUE
) -> bool:
    """
    Invalidate workflow processing cache entries for a specific detector.

    Queries DetectorWorkflow to find all affected cache keys and deletes them explicitly.

    Note: Global invalidation is not supported. Cache has a 60-second TTL, so migrations
    can safely wait for natural expiration rather than risking OOM from millions of rows.

    Args:
        detector_id: Detector ID to invalidate (required)
        env_id: {int|None} - The environment the workflow is triggered on, if not set,
                             "default" will be used to invalidate _all_ environments.

    Returns:
        True if at least one cache entry was deleted, False otherwise
    """
    metrics_incr(f"{METRIC_PREFIX}.invalidated")

    if env_id is not DEFAULT_VALUE:
        cache_key = processing_workflow_cache_key(detector_id, env_id)
        return cache.delete(cache_key)

    # Lookup all of the environment_ids associated with the Detector,
    # TODO - improve this to track active keys in Redis
    environment_ids = (
        DetectorWorkflow.objects.filter(detector_id=detector_id)
        .select_related("workflow")
        .values_list("workflow__environment_id", flat=True)
    )

    # Build explicit cache keys from relationships
    keys: set[str] = set()

    for environment_id in environment_ids:
        keys.add(processing_workflow_cache_key(detector_id, environment_id))

    # Also add key for workflows with no environment
    keys.add(processing_workflow_cache_key(detector_id, None))

    if keys:
        cache.delete_many(keys)
        metrics_incr(f"{METRIC_PREFIX}.keys_deleted", value=len(keys))

    return len(keys) > 0


def get_processing_workflows(detector: Detector, environment: Environment | None) -> set[Workflow]:
    """
    Use this method to select workflows for processing.

    This method uses a read-through cache, and returns which workflows to evaluate.
    """
    env_id = environment.id if environment is not None else None
    cache_key = processing_workflow_cache_key(detector.id, env_id)
    workflows = cache.get(cache_key)

    if workflows is None:
        metrics_incr(f"{METRIC_PREFIX}.miss")

        environment_filter = (
            (Q(environment_id=None) | Q(environment_id=environment.id))
            if environment
            else Q(environment_id=None)
        )

        workflows = set(
            Workflow.objects.filter(
                environment_filter,
                detectorworkflow__detector_id=detector.id,
                enabled=True,
            )
            .select_related("environment")
            .distinct()
        )

        cache.set(cache_key, workflows, timeout=CACHE_TTL)
    else:
        metrics_incr(f"{METRIC_PREFIX}.hit")

    return workflows

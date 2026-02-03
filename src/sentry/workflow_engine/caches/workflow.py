from typing import Literal

from django.db.models import Q

from sentry.models.environment import Environment
from sentry.utils.cache import cache
from sentry.workflow_engine.caches import CacheAccess
from sentry.workflow_engine.models import Detector, DetectorWorkflow, Workflow
from sentry.workflow_engine.utils.metrics import metrics_incr

# Cache timeout for 1 minute
CACHE_TTL = 60  # TODO - Increase TTL once we confirm everything
METRIC_PREFIX = "workflow_engine.cache.processing_workflow"

DEFAULT_VALUE: Literal["default"] = "default"
WORKFLOW_CACHE_PREFIX = "workflows_by_detector_env"


class _WorkflowCacheAccess(CacheAccess[set[Workflow]]):
    # To reduce look-ups, this uses id's instead of requiring the full model for types
    def __init__(self, detector_id: int, env_id: int | None):
        self._key = f"{WORKFLOW_CACHE_PREFIX}:{detector_id}:{env_id}"

    def key(self) -> str:
        return self._key


def invalidate_processing_workflows(
    detector_id: int, env_id: int | None | Literal["default"] = DEFAULT_VALUE
) -> bool:
    """
    Invalidate workflow processing cache entries for a specific detector.

    If the environment_id or None is not provided, this will query to find _all_
    all environments that are configured for workflows through the DetectorWorkflow table.

    TODO - We could further reduce DB load here by creating a list of envs for each
    detector in redis, then getting that list for invalidation here and clearing it.

    Args:
        detector_id: Detector ID to invalidate (required)
        env_id: {int|None} - The environment the workflow is triggered on, if not set,
                             "default" will be used to invalidate _all_ environments.

    Returns:
        True if at least one cache entry was deleted, False otherwise
    """
    metrics_incr(f"{METRIC_PREFIX}.invalidated")

    if env_id is not DEFAULT_VALUE:
        return _WorkflowCacheAccess(detector_id, env_id).delete()

    # Lookup all of the environment_ids associated with the Detector,
    # TODO - improve this so we don't need to go to the DB, we could
    # track everything in redis instead.
    environment_ids = (
        DetectorWorkflow.objects.filter(detector_id=detector_id)
        .select_related("workflow")
        .values_list("workflow__environment_id", flat=True)
    )

    # Build explicit cache keys from relationships
    keys = {_WorkflowCacheAccess(detector_id, env_id).key() for env_id in environment_ids}
    # Also add key for workflows with no environment
    keys.add(_WorkflowCacheAccess(detector_id, None).key())

    if keys:
        cache.delete_many(keys)
        metrics_incr(f"{METRIC_PREFIX}.keys_deleted", value=len(keys))

    return len(keys) > 0


def get_cached_workflows(detector: Detector, environment: Environment | None) -> set[Workflow]:
    env_id = environment.id if environment is not None else None
    cache_access = _WorkflowCacheAccess(detector.id, env_id)
    workflows = cache_access.get()

    if workflows is None:
        metrics_incr(f"{METRIC_PREFIX}.miss")

        # TODO - split the `None` environments into a separate cache to reduce data replication
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

        cache_access.set(workflows, CACHE_TTL)
    else:
        metrics_incr(f"{METRIC_PREFIX}.hit")

    return workflows

from collections.abc import Collection
from typing import Literal, NamedTuple

from django.db.models import Q

from sentry.models.environment import Environment
from sentry.utils.cache import cache
from sentry.workflow_engine.caches import CacheAccess
from sentry.workflow_engine.models import Detector, DetectorWorkflow, Workflow
from sentry.workflow_engine.utils import scopedstats
from sentry.workflow_engine.utils.metrics import metrics_incr

# Cache timeout for 1 minute
CACHE_TTL = 60  # TODO - Increase TTL once we confirm everything
METRIC_PREFIX = "workflow_engine.cache.processing_workflow"

DEFAULT_VALUE: Literal["default"] = "default"
WORKFLOW_CACHE_PREFIX = "workflows_by_detector_env"


class _CacheLookupResult(NamedTuple):
    """
    Result of checking cache for detector workflows.
    """

    cached_workflows: set[Workflow]
    missed_detector_ids: list[int]

    @property
    def all_hits(self) -> bool:
        return len(self.missed_detector_ids) == 0


class _WorkflowsByDetector(NamedTuple):
    """
    Workflows grouped by detector ID with helper methods.
    """

    mapping: dict[int, set[Workflow]]

    @property
    def all_workflows(self) -> set[Workflow]:
        result: set[Workflow] = set()

        for workflows in self.mapping.values():
            result |= workflows

        return result


class _SplitWorkflowsByDetector(NamedTuple):
    """
    Workflows split by environment: global (env_id=None) vs env-specific.
    This enables storing each environment's workflows in separate cache entries,
    so invalidation of global workflows doesn't require invalidating env-specific caches.
    """

    global_workflows: _WorkflowsByDetector  # env_id=None workflows
    env_workflows: _WorkflowsByDetector  # env_id=X workflows (may be empty)


class _WorkflowCacheAccess(CacheAccess[set[Workflow]]):
    """
    To reduce look-ups, this uses id's instead of requiring the full model for types
    """

    def __init__(self, detector_id: int, env_id: int | None):
        self._key = f"{WORKFLOW_CACHE_PREFIX}:{detector_id}:{env_id}"

    def key(self) -> str:
        return self._key


def _invalidate_all_environments(detector_id: int) -> bool:
    """
    Invalidate all cache entries for a detector across all environments.

    TODO - track keys in redis on create to remove DB look-ups
    """
    environment_ids = (
        DetectorWorkflow.objects.filter(detector_id=detector_id)
        .select_related("workflow")
        .values_list("workflow__environment_id", flat=True)
    )

    keys = {_WorkflowCacheAccess(detector_id, env_id).key() for env_id in environment_ids}
    keys.add(_WorkflowCacheAccess(detector_id, None).key())

    if keys:
        cache.delete_many(keys)
        metrics_incr(f"{METRIC_PREFIX}.invalidated_all", value=len(keys))

    return len(keys) > 0


@scopedstats.timer()
def invalidate_processing_workflows(
    detector_id: int, env_id: int | None | Literal["default"] = DEFAULT_VALUE
) -> bool:
    """
    Invalidate workflow processing cache entries for a specific detector.

    If the environment_id or None is not provided, this will query to find _all_
    all environments that are configured for workflows through the DetectorWorkflow table.

    Args:
        detector_id: Detector ID to invalidate (required)
        env_id: {int|None} - The environment the workflow is triggered on, if not set,
                             "default" will be used to invalidate _all_ environments.

    Returns:
        True if at least one cache entry was deleted, False otherwise
    """

    if env_id == DEFAULT_VALUE:
        return _invalidate_all_environments(detector_id)

    metrics_incr(f"{METRIC_PREFIX}.invalidated")
    return _WorkflowCacheAccess(detector_id, env_id).delete()


def _check_caches_for_detectors(
    detectors: Collection[Detector], env_id: int | None
) -> _CacheLookupResult:
    """
    Check cache for each detector, returning cached workflows and cache-missed detector IDs.

    Args:
        detectors: Collection of Detector objects to check cache for
        env_id: Environment ID (or None) for cache key

    Returns:
        _CacheLookupResult with cached_workflows and missed_detector_ids
    """
    workflows: set[Workflow] = set()
    missed_detector_ids: list[int] = []

    for detector in detectors:
        cache_access = _WorkflowCacheAccess(detector.id, env_id)
        cached = cache_access.get()

        if cached is not None:
            workflows |= cached
            metrics_incr(f"{METRIC_PREFIX}.hit")
        else:
            missed_detector_ids.append(detector.id)
            metrics_incr(f"{METRIC_PREFIX}.miss")

    return _CacheLookupResult(workflows, missed_detector_ids)


def _query_workflows_by_detector_ids(
    detector_ids: Collection[int], env_id: int | None
) -> _SplitWorkflowsByDetector:
    """
    Query DB for workflows and split by actual environment_id.

    Returns separate mappings for global (env_id=None) vs env-specific workflows.
    This enables storing each in separate cache entries for targeted invalidation.

    Args:
        detector_ids: Collection of detector IDs to query for
        env_id: Environment ID to filter by (or None for global-only)

    Returns:
        _SplitWorkflowsByDetector with global_workflows and env_workflows
    """
    environment_filter = (
        (Q(workflow__environment_id=None) | Q(workflow__environment_id=env_id))
        if env_id
        else Q(workflow__environment_id=None)
    )

    detector_workflow_mappings = DetectorWorkflow.objects.filter(
        environment_filter,
        detector_id__in=detector_ids,
        workflow__enabled=True,
    ).select_related("workflow", "workflow__environment")

    # Split results by actual environment_id
    global_by_detector: dict[int, set[Workflow]] = {d_id: set() for d_id in detector_ids}
    env_by_detector: dict[int, set[Workflow]] = {d_id: set() for d_id in detector_ids}

    for dw in detector_workflow_mappings:
        if dw.workflow.environment_id is None:
            global_by_detector[dw.detector_id].add(dw.workflow)
        else:
            env_by_detector[dw.detector_id].add(dw.workflow)

    return _SplitWorkflowsByDetector(
        _WorkflowsByDetector(global_by_detector),
        _WorkflowsByDetector(env_by_detector),
    )


def _populate_detector_caches(
    split_workflows: _SplitWorkflowsByDetector, env_id: int | None
) -> None:
    """
    Populate cache entries for each detector, storing global and env-specific separately.

    Global workflows (env_id=None) are stored in the global cache key.
    Env-specific workflows are stored in the env-specific cache key (only if env_id was specified).

    Args:
        split_workflows: SplitWorkflowsByDetector with global and env-specific workflows
        env_id: Environment ID for the env-specific cache (None for global-only query)
    """
    # Always store global workflows in env_id=None cache
    for detector_id, workflows in split_workflows.global_workflows.mapping.items():
        _WorkflowCacheAccess(detector_id, None).set(workflows, CACHE_TTL)

    # Store env-specific workflows in env_id=X cache (only if env_id was specified)
    if env_id is not None:
        for detector_id, workflows in split_workflows.env_workflows.mapping.items():
            _WorkflowCacheAccess(detector_id, env_id).set(workflows, CACHE_TTL)


@scopedstats.timer()
def get_workflows_by_detectors(
    detectors: Collection[Detector],
    environment: Environment | None,
) -> set[Workflow]:
    """
    Get workflows for multiple detectors, using per-detector caching.

    Workflows are stored in separate cache entries by their actual environment_id:
    - Global workflows (env_id=None) are always checked
    - Env-specific workflows are checked when an environment is specified

    Cache misses are batched into a single DB query for efficiency then results
    are split by environment and stored in separate cache entries for efficient
    cache interactions.
    """
    if not detectors:
        return set()

    env_id = environment.id if environment is not None else None
    workflows: set[Workflow] = set()

    global_result = _check_caches_for_detectors(detectors, env_id=None)
    workflows |= global_result.cached_workflows

    env_result = None
    if env_id is not None:
        env_result = _check_caches_for_detectors(detectors, env_id)
        workflows |= env_result.cached_workflows

    missed_detector_ids = set(global_result.missed_detector_ids)
    if env_result:
        missed_detector_ids |= set(env_result.missed_detector_ids)

    if missed_detector_ids:
        workflow_query_results = _query_workflows_by_detector_ids(list(missed_detector_ids), env_id)
        _populate_detector_caches(workflow_query_results, env_id)

        workflows |= workflow_query_results.global_workflows.all_workflows
        workflows |= workflow_query_results.env_workflows.all_workflows

    return workflows

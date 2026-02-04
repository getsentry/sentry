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
) -> _WorkflowsByDetector:
    """
    Query DB for workflows and group by detector ID.

    Args:
        detector_ids: Collection of detector IDs to query for
        env_id: Environment ID to filter by (or None for all environment)

    Returns:
        _WorkflowsByDetector with mapping of detector_id to set of Workflows
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

    workflows_by_detector: dict[int, set[Workflow]] = {d_id: set() for d_id in detector_ids}

    for dw in detector_workflow_mappings:
        workflows_by_detector[dw.detector_id].add(dw.workflow)

    return _WorkflowsByDetector(workflows_by_detector)


def _populate_detector_caches(
    workflows_by_detector: _WorkflowsByDetector, env_id: int | None
) -> None:
    """
    Populate cache entries for each detector.

    Args:
        workflows_by_detector: WorkflowsByDetector containing detector_id to Workflow mappings
        env_id: Environment ID
    """
    for detector_id, detector_workflows in workflows_by_detector.mapping.items():
        _WorkflowCacheAccess(detector_id, env_id).set(detector_workflows, CACHE_TTL)


@scopedstats.timer()
def get_workflows_by_detectors(
    detectors: Collection[Detector],
    environment: Environment | None,
) -> set[Workflow]:
    """
    Get workflows for multiple detectors, using per-detector caching.

    Cache misses are batched into a single DB query for efficiency then merge results.
    """
    if not detectors:
        return set()

    env_id = environment.id if environment is not None else None
    cache_result = _check_caches_for_detectors(detectors, env_id)

    if cache_result.all_hits:
        return cache_result.cached_workflows

    uncached_workflows_by_detector = _query_workflows_by_detector_ids(
        cache_result.missed_detector_ids, env_id
    )

    _populate_detector_caches(uncached_workflows_by_detector, env_id)
    return cache_result.cached_workflows | uncached_workflows_by_detector.all_workflows

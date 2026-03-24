from collections.abc import Collection
from typing import NamedTuple

from django.db.models import F

from sentry.workflow_engine.caches.mapping import CacheMapping
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.models.workflow import Workflow
from sentry.workflow_engine.types import WorkflowId
from sentry.workflow_engine.utils import scopedstats
from sentry.workflow_engine.utils.metrics import metrics_incr

CACHE_TTL = 300  # 5 minutes
ACTION_FILTER_CACHE_NAME = "action_filters_by_workflow"
METRIC_PREFIX = f"workflow_engine.cache.processing_workflow.{ACTION_FILTER_CACHE_NAME}"
ActionFiltersByWorkflow = dict[WorkflowId, list[DataConditionGroup]]


class _ActionFilterCacheKey(NamedTuple):
    workflow_id: WorkflowId


class _CacheResults(NamedTuple):
    cached: ActionFiltersByWorkflow
    missed_ids: list[WorkflowId]


_action_filters_cache = CacheMapping[_ActionFilterCacheKey, list[DataConditionGroup]](
    lambda key: f"{key.workflow_id}",
    namespace=f"workflow:{ACTION_FILTER_CACHE_NAME}",
    ttl_seconds=CACHE_TTL,
)


def _check_cache_by_workflows(workflows: Collection[Workflow]) -> _CacheResults:
    results: ActionFiltersByWorkflow = {}
    missed_ids: list[WorkflowId] = []

    keys = [_ActionFilterCacheKey(w.id) for w in workflows]
    cache_results = _action_filters_cache.get_many(inputs=keys)

    for key, cached in cache_results.items():
        if cached is not None:
            results[key.workflow_id] = cached
            metrics_incr(f"{METRIC_PREFIX}.hit")
        else:
            missed_ids.append(key.workflow_id)
            metrics_incr(f"{METRIC_PREFIX}.miss")

    return _CacheResults(
        cached=results,
        missed_ids=missed_ids,
    )


def _query_action_filters_by_workflows(workflow_ids: list[WorkflowId]) -> ActionFiltersByWorkflow:
    decorated_action_filters = list(
        DataConditionGroup.objects.filter(workflowdataconditiongroup__workflow_id__in=workflow_ids)
        .prefetch_related("conditions")
        .annotate(workflow_id=F("workflowdataconditiongroup__workflow_id"))
    )

    action_filters_by_workflow: ActionFiltersByWorkflow = {wid: [] for wid in workflow_ids}

    for action_filter in decorated_action_filters:
        action_filters_by_workflow[action_filter.workflow_id].append(action_filter)

    return action_filters_by_workflow


def _populate_cache(action_filters_by_workflow: ActionFiltersByWorkflow) -> None:
    cache_items: dict[_ActionFilterCacheKey, list[DataConditionGroup]] = {
        _ActionFilterCacheKey(workflow_id): action_filters
        for workflow_id, action_filters in action_filters_by_workflow.items()
    }

    _action_filters_cache.set_many(cache_items)


@scopedstats.timer()
def get_action_filters_by_workflows(
    workflows: Collection[Workflow],
) -> ActionFiltersByWorkflow:
    """
    Get the action filters for a collection of Workflows from a cache or fall through to query

    Each workflow has an individual cache of conditions that we check, and collate to the results.
    If the cache is empty for a specific workflow, it will query the DB and add the result to the cache.

    Args:
        workflows: Collection[Workflow] a collection of the workflows to get the filters for

    Returns:
        dict[WorkflowId, list[DataConditionGroup]] mapping workflow IDs to their action filters.
            Each list contains the DataConditionGroups with prefetched conditions.
    """
    # TODO - use this hook in `processors/workflow.py`'s evaluate_workflows_action_filters <- last item.
    if not workflows:
        return {}

    cache_results = _check_cache_by_workflows(workflows)
    action_filters_by_workflow = cache_results.cached

    if cache_results.missed_ids:
        query_results = _query_action_filters_by_workflows(cache_results.missed_ids)
        _populate_cache(query_results)

        for workflow_id, action_filters in query_results.items():
            action_filters_by_workflow[workflow_id] = action_filters

    return action_filters_by_workflow


@scopedstats.timer()
def invalidate_action_filter_cache_by_workflow_ids(workflow_ids: list[WorkflowId]) -> None:
    """
    Takes a list of workflow ids and clears the cached values for the stored information

    Models that have receivers to invalidate the cache:
    - WorkflowDataConditionGroup post_save - When an action filter is created on a workflow
    - WorkflowDataConditionGroup pre_delete - When an action filter is removed from the workflow
    - DataCondition post_save - When a condition on a filter is changed
    - DataCondition pre_delete - When a condition on the filter being removed
    - DataConditionGroup post_save - When an update to the logic type in the condition group
    """
    metrics_incr(f"{METRIC_PREFIX}.invalidated", value=len(workflow_ids))
    cache_keys = [_ActionFilterCacheKey(wid) for wid in workflow_ids]

    _action_filters_cache.delete_many(cache_keys)

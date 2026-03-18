from collections.abc import Generator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.action_filters import (
    ActionFiltersByWorkflow,
    _action_filters_cache,
    _ActionFilterCacheKey,
    _CacheResults,
    _populate_cache,
    get_action_filters_by_workflows,
)
from sentry.workflow_engine.models import (
    DataConditionGroup,
    Workflow,
)


@contextmanager
def mock_query_action_filters(
    return_value: ActionFiltersByWorkflow | None = None,
) -> Generator[MagicMock]:
    with patch(
        "sentry.workflow_engine.caches.action_filters._query_action_filters_by_workflows",
        return_value=return_value,
    ) as mock_query:
        yield mock_query


@contextmanager
def mock_check_action_filters_cache(
    return_value: _CacheResults | None = None,
) -> Generator[MagicMock]:
    with patch(
        "sentry.workflow_engine.caches.action_filters._check_cache_by_workflows",
        return_value=return_value,
    ) as mock_cache:
        yield mock_cache


class ActionFilterTestCase(TestCase):
    def create_action_filters_for_workflow(
        self,
        workflow: Workflow,
        num_filters: int = 1,
        num_conditions: int = 0,
    ) -> list[DataConditionGroup]:
        action_filters: list[DataConditionGroup] = [
            self.create_data_condition_group() for _ in range(num_filters)
        ]

        for action_filter in action_filters:
            self.create_workflow_data_condition_group(
                workflow=workflow, condition_group=action_filter
            )

            action_filter.conditions.set(
                [
                    self.create_data_condition(condition_group=action_filter)
                    for _ in range(num_conditions)
                ]
            )

        return action_filters

    def populate_action_filter_cache(
        cache_data: ActionFiltersByWorkflow,
    ) -> list[_ActionFilterCacheKey]:
        _populate_cache(cache_data)
        cache_keys = [_ActionFilterCacheKey(wid) for wid in cache_data.keys()]

        for cache_key in cache_keys:
            assert _action_filters_cache.get(cache_key) == cache_data[cache_key.workflow_id]

        return cache_keys

    def get_data_from_cache(cache_keys: list[_ActionFilterCacheKey]) -> ActionFiltersByWorkflow:
        return _action_filters_cache.get_many(cache_keys)

    def assert_cache_result(
        self,
        results: ActionFiltersByWorkflow,
        workflow: Workflow,
        expected_action_filters: list[DataConditionGroup],
    ) -> None:
        result_filters = results[workflow.id]

        for result_filter, expected_filter in zip(
            result_filters, expected_action_filters, strict=True
        ):
            assert result_filter.id == expected_filter.id

            # check each condition is the same
            result_conditions = result_filter.conditions.all()
            expected_conditions = expected_filter.conditions.all()

            for result_cond, expected_cond in zip(
                result_conditions, expected_conditions, strict=True
            ):
                assert result_cond.id == expected_cond.id


class TestActionFilterCache(ActionFilterTestCase):
    def test_no_workflows_passed(self) -> None:
        result = get_action_filters_by_workflows([])
        assert result == {}

    def test_all_cache_miss__one_workflow(self) -> None:
        workflow = self.create_workflow()
        action_filters = self.create_action_filters_for_workflow(
            workflow=workflow,
            num_conditions=2,
        )

        with mock_check_action_filters_cache(_CacheResults(cached={}, missed_ids=[workflow.id])):
            results = get_action_filters_by_workflows([workflow])

        self.assert_cache_result(results, workflow, action_filters)

    def test_all_cache_hits__one_workflow(self) -> None:
        workflow = self.create_workflow()
        action_filters = self.create_action_filters_for_workflow(
            workflow=workflow,
            num_conditions=2,
        )

        _populate_cache({workflow.id: action_filters})

        with mock_query_action_filters() as mock_query:
            results = get_action_filters_by_workflows([workflow])
            mock_query.assert_not_called()

        self.assert_cache_result(results, workflow, action_filters)

    def test_all_cache_miss__many_workflows(self) -> None:
        workflow = self.create_workflow()
        action_filters = self.create_action_filters_for_workflow(
            workflow=workflow,
            num_conditions=1,
        )

        workflow_two = self.create_workflow()
        action_filters_two = self.create_action_filters_for_workflow(
            workflow=workflow_two,
            num_filters=2,
        )

        with mock_check_action_filters_cache(
            _CacheResults(cached={}, missed_ids=[workflow.id, workflow_two.id])
        ):
            results = get_action_filters_by_workflows([workflow, workflow_two])

        self.assert_cache_result(results, workflow, action_filters)
        self.assert_cache_result(results, workflow_two, action_filters_two)

    def test_all_cache_hits__many_workflows(self) -> None:
        workflow = self.create_workflow()
        action_filters = self.create_action_filters_for_workflow(
            workflow=workflow,
            num_conditions=1,
        )

        workflow_two = self.create_workflow()
        action_filters_two = self.create_action_filters_for_workflow(
            workflow=workflow_two,
            num_filters=2,
            num_conditions=1,
        )

        _populate_cache(
            {
                workflow.id: action_filters,
                workflow_two.id: action_filters_two,
            }
        )

        with mock_query_action_filters() as mock_query:
            results = get_action_filters_by_workflows([workflow, workflow_two])
            mock_query.assert_not_called()

        self.assert_cache_result(results, workflow, action_filters)
        self.assert_cache_result(results, workflow_two, action_filters_two)

    def test_mixed_cache_hits(self) -> None:
        workflow = self.create_workflow()
        action_filters = self.create_action_filters_for_workflow(
            workflow=workflow,
            num_conditions=1,
        )

        workflow_two = self.create_workflow()
        action_filters_two = self.create_action_filters_for_workflow(
            workflow=workflow_two,
            num_filters=2,
            num_conditions=1,
        )

        _populate_cache(
            {
                workflow_two.id: action_filters_two,
            }
        )

        results = get_action_filters_by_workflows([workflow, workflow_two])

        self.assert_cache_result(results, workflow, action_filters)
        self.assert_cache_result(results, workflow_two, action_filters_two)

    def test_mixed_cache_hits__filters_query(self) -> None:
        workflow = self.create_workflow()
        action_filters = self.create_action_filters_for_workflow(
            workflow=workflow,
            num_conditions=1,
        )
        workflow_two = self.create_workflow()
        action_filters_two = self.create_action_filters_for_workflow(
            workflow=workflow_two,
            num_filters=2,
            num_conditions=1,
        )

        _populate_cache(
            {
                workflow_two.id: action_filters_two,
            }
        )

        with mock_query_action_filters(return_value={workflow.id: action_filters}) as mock_query:
            results = get_action_filters_by_workflows([workflow, workflow_two])
            mock_query.assert_called_once_with([workflow.id])

        self.assert_cache_result(results, workflow, action_filters)
        self.assert_cache_result(results, workflow_two, action_filters_two)

    def test_workflow_with_no_filters_is_cached(self) -> None:
        workflow = self.create_workflow()

        # First call - cache miss, queries DB
        result = get_action_filters_by_workflows([workflow])
        assert result[workflow.id] == []

        # Second call - should be cache hit, no DB query
        with mock_query_action_filters() as mock_query:
            result = get_action_filters_by_workflows([workflow])
            mock_query.assert_not_called()

        assert result[workflow.id] == []

    def test_prefetched_conditions_survive_cache(self) -> None:
        workflow = self.create_workflow()
        self.create_action_filters_for_workflow(
            workflow=workflow,
            num_conditions=2,
        )

        # First call populates cache
        get_action_filters_by_workflows([workflow])

        # Second call retrieves from cache
        with self.assertNumQueries(0):  # No DB queries
            cached_results = get_action_filters_by_workflows([workflow])

            for dcg in cached_results[workflow.id]:
                list(dcg.conditions.all())

from unittest.mock import patch

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.action_filters import (
    ActionFiltersByWorkflow,
    _CacheResults,
    _populate_cache,
    get_action_filters_by_workflows,
)
from sentry.workflow_engine.models import (
    DataConditionGroup,
    Workflow,
)


class TestActionFilterCache(TestCase):
    def create_workflow_with_filters(
        self, num_filters: int = 1, num_conditions: int = 1
    ) -> tuple[
        Workflow,
        list[DataConditionGroup],
    ]:
        workflow = self.create_workflow()
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

        return workflow, action_filters

    def assert_cache_result(
        self,
        results: ActionFiltersByWorkflow,
        workflow: Workflow,
        expected_action_filters: list[DataConditionGroup],
    ) -> None:
        result_filters = results[workflow.id]
        assert len(result_filters) == len(expected_action_filters)

        for i in range(len(expected_action_filters)):
            assert result_filters[i].id == expected_action_filters[i].id

            # check each condition is the same
            result_conditions = result_filters[i].conditions.all()
            expected_conditions = expected_action_filters[i].conditions.all()

            for j in range(len(expected_conditions)):
                assert result_conditions[j].id == expected_conditions[j].id

    def test_no_workflows_passed(self) -> None:
        result = get_action_filters_by_workflows([])
        assert result == {}

    def test_all_cache_miss__one_workflow(self) -> None:
        num_conditions = 2
        workflow, action_filters = self.create_workflow_with_filters(num_conditions=num_conditions)

        with patch(
            "sentry.workflow_engine.caches.action_filters._check_cache_by_workflows",
            return_value=_CacheResults(cached={}, missed_ids=[workflow.id]),
        ):
            results = get_action_filters_by_workflows([workflow])

        self.assert_cache_result(results, workflow, action_filters)

    def test_all_cache_hits__one_workflow(self) -> None:
        num_conditions = 2
        workflow, action_filters = self.create_workflow_with_filters(num_conditions=num_conditions)

        _populate_cache({workflow.id: action_filters})

        with patch(
            "sentry.workflow_engine.caches.action_filters._get_action_filters_by_workflows"
        ) as mock_query:
            results = get_action_filters_by_workflows([workflow])
            mock_query.assert_not_called()

        self.assert_cache_result(results, workflow, action_filters)

    def test_all_cache_miss__many_workflows(self) -> None:
        workflow, action_filters = self.create_workflow_with_filters()
        workflow_two, action_filters_two = self.create_workflow_with_filters(num_filters=2)

        with patch(
            "sentry.workflow_engine.caches.action_filters._check_cache_by_workflows",
            return_value=_CacheResults(cached={}, missed_ids=[workflow.id, workflow_two.id]),
        ):
            results = get_action_filters_by_workflows([workflow, workflow_two])

        self.assert_cache_result(results, workflow, action_filters)
        self.assert_cache_result(results, workflow_two, action_filters_two)

    def test_all_cache_hits__many_workflows(self) -> None:
        workflow, action_filters = self.create_workflow_with_filters()
        workflow_two, action_filters_two = self.create_workflow_with_filters(num_filters=2)

        _populate_cache(
            {
                workflow.id: action_filters,
                workflow_two.id: action_filters_two,
            }
        )

        with patch(
            "sentry.workflow_engine.caches.action_filters._get_action_filters_by_workflows"
        ) as mock_query:
            results = get_action_filters_by_workflows([workflow, workflow_two])
            mock_query.assert_not_called()

        self.assert_cache_result(results, workflow, action_filters)
        self.assert_cache_result(results, workflow_two, action_filters_two)

    def test_mixed_cache_hits(self) -> None:
        workflow, action_filters = self.create_workflow_with_filters()
        workflow_two, action_filters_two = self.create_workflow_with_filters(num_filters=2)

        _populate_cache(
            {
                workflow_two.id: action_filters_two,
            }
        )

        results = get_action_filters_by_workflows([workflow, workflow_two])

        self.assert_cache_result(results, workflow, action_filters)
        self.assert_cache_result(results, workflow_two, action_filters_two)

    def test_mixed_cache_hits__filters_query(self) -> None:
        workflow, action_filters = self.create_workflow_with_filters()
        workflow_two, action_filters_two = self.create_workflow_with_filters(num_filters=2)

        _populate_cache(
            {
                workflow_two.id: action_filters_two,
            }
        )

        with patch(
            "sentry.workflow_engine.caches.action_filters._get_action_filters_by_workflows",
            return_value={workflow.id: action_filters},
        ) as mock_query:
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
        with patch(
            "sentry.workflow_engine.caches.action_filters._get_action_filters_by_workflows"
        ) as mock_query:
            result = get_action_filters_by_workflows([workflow])
            mock_query.assert_not_called()

        assert result[workflow.id] == []

    def test_prefetched_conditions_survive_cache(self) -> None:
        workflow, _ = self.create_workflow_with_filters(num_conditions=2)

        # First call populates cache
        get_action_filters_by_workflows([workflow])

        # Second call retrieves from cache
        with self.assertNumQueries(0):  # No DB queries
            cached_results = get_action_filters_by_workflows([workflow])

            for dcg in cached_results[workflow.id]:
                list(dcg.conditions.all())

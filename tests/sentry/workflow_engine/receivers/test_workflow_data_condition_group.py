from sentry.testutils.cases import TestCase
from sentry.workflow_engine.caches.action_filters import (
    _action_filters_cache,
    _ActionFilterCacheKey,
    _populate_cache,
)
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.models.workflow import Workflow
from sentry.workflow_engine.models.workflow_data_condition_group import WorkflowDataConditionGroup


class TestWorkflowDataConditionGroupReceivers(TestCase):
    def create_workflow_with_filters(
        self, num_filters: int = 1, num_conditions: int = 1
    ) -> tuple[
        Workflow,
        list[DataConditionGroup],
        list[WorkflowDataConditionGroup],
    ]:
        workflow = self.create_workflow()
        action_filters: list[DataConditionGroup] = [
            self.create_data_condition_group() for _ in range(num_filters)
        ]

        workflow_condition_groups: list[WorkflowDataConditionGroup] = []
        for action_filter in action_filters:
            wcg = self.create_workflow_data_condition_group(
                workflow=workflow, condition_group=action_filter
            )

            workflow_condition_groups.append(wcg)

            action_filter.conditions.set(
                [
                    self.create_data_condition(condition_group=action_filter)
                    for _ in range(num_conditions)
                ]
            )

        return workflow, action_filters, workflow_condition_groups

    def test_cache_invalidation_on_delete(self) -> None:
        workflow, action_filters, workflow_data_condition_groups = (
            self.create_workflow_with_filters()
        )

        _populate_cache({workflow.id: action_filters})
        cache_key = _ActionFilterCacheKey(workflow.id)

        # ensure the cache is populated
        assert len(_action_filters_cache.get(cache_key)) == 1

        workflow_data_condition_groups[0].delete()
        assert _action_filters_cache.get(cache_key) is None

    def test_cache_invalidation_on_save(self) -> None:
        workflow, action_filters, _ = self.create_workflow_with_filters()

        # ensure the cache is populated
        _populate_cache({workflow.id: action_filters})
        cache_key = _ActionFilterCacheKey(workflow.id)
        assert len(_action_filters_cache.get(cache_key)) == 1

        # add another data condition group to the workflow
        new_action_filter = self.create_data_condition_group()
        self.create_workflow_data_condition_group(
            workflow=workflow,
            condition_group=new_action_filter,
        )

        assert _action_filters_cache.get(cache_key) is None

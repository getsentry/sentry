from sentry.workflow_engine.caches.action_filters import ActionFiltersByWorkflow
from sentry.workflow_engine.models.workflow_data_condition_group import WorkflowDataConditionGroup
from tests.sentry.workflow_engine.caches.test_action_filters import ActionFilterTestCase


class TestWorkflowDataConditionGroupReceivers(ActionFilterTestCase):
    def setUp(self) -> None:
        self.workflow = self.create_workflow()
        self.action_filters = self.create_action_filters_for_workflow(
            workflow=self.workflow,
        )

        action_filter_ids = [action_filter.id for action_filter in self.action_filters]
        self.workflow_data_condition_groups = WorkflowDataConditionGroup.objects.filter(
            condition_group_id__in=action_filter_ids,
        )

    def test_cache_invalidation_on_delete(self) -> None:
        cache_data: ActionFiltersByWorkflow = {self.workflow.id: self.action_filters}
        cache_keys = self.populate_action_filter_cache(cache_data)

        # ensure the cache is populated
        assert self.get_data_from_cache(cache_keys) == cache_data

        self.workflow_data_condition_groups[0].delete()
        assert self.get_data_from_cache(cache_keys) == {self.workflow.id: None}

    def test_cache_invalidation_on_save(self) -> None:
        cache_data: ActionFiltersByWorkflow = {self.workflow.id: self.action_filters}
        cache_keys = self.populate_action_filter_cache(cache_data)

        # add another data condition group to the workflow
        self.create_action_filters_for_workflow(workflow=self.workflow, num_filters=1)

        assert self.get_data_from_cache(cache_keys) == {self.workflow.id: None}

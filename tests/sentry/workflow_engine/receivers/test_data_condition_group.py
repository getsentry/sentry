from sentry.workflow_engine.caches.action_filters import ActionFiltersByWorkflow
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from tests.sentry.workflow_engine.caches.test_action_filters import ActionFilterTestCase


class TestPostSaveActionFilterCacheDCG(ActionFilterTestCase):
    def test_modify_action_filter_condition_logic(self) -> None:
        workflow = self.create_workflow()
        condition_groups = self.create_action_filters_for_workflow(
            workflow=workflow,
            num_filters=1,
        )

        # Warm the cache
        cache_data: ActionFiltersByWorkflow = {workflow.id: condition_groups}
        cache_keys = self.populate_action_filter_cache(cache_data)
        assert self.get_data_from_cache(cache_keys) == cache_data

        condition_group = condition_groups[0]
        condition_group.logic_type = DataConditionGroup.Type.ALL.value
        condition_group.save()

        assert self.get_data_from_cache(cache_keys) == {workflow.id: None}

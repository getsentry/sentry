from sentry.workflow_engine.caches.action_filters import ActionFiltersByWorkflow
from sentry.workflow_engine.models import DataCondition
from tests.sentry.workflow_engine.caches.test_action_filters import ActionFilterTestCase


class TestPreDeleteActionFilterCacheInvalidation(ActionFilterTestCase):
    def test_delete_data_condition(self) -> None:
        workflow = self.create_workflow()
        condition_groups = self.create_action_filters_for_workflow(
            workflow,
            num_filters=1,
            num_conditions=1,
        )

        # Warm the cache
        cache_data: ActionFiltersByWorkflow = {workflow.id: condition_groups}
        cache_keys = self.populate_action_filter_cache(cache_data)
        assert self.get_data_from_cache(cache_keys) == cache_data

        first_condition = condition_groups[0].conditions.all().first()
        assert isinstance(first_condition, DataCondition)

        first_condition.delete()
        assert self.get_data_from_cache(cache_keys) == {workflow.id: None}


class TestPostSaveActionFilterCacheInvalidation(ActionFilterTestCase):
    def test_new_condition_added_to_filters(self) -> None:
        workflow = self.create_workflow()
        condition_groups = self.create_action_filters_for_workflow(workflow)

        # Warm the cache
        cache_data: ActionFiltersByWorkflow = {workflow.id: condition_groups}
        cache_keys = self.populate_action_filter_cache(cache_data)

        # Make a change that invalidates the cache.
        new_condition = self.create_data_condition(condition_group=condition_groups[0])

        assert new_condition is not None

        cached_value = self.get_data_from_cache(cache_keys)[workflow.id]
        assert cached_value is None

    def test_new_condition_without_associations_keeps_cache_intact(self) -> None:
        workflow = self.create_workflow()
        condition_groups = self.create_action_filters_for_workflow(workflow)

        # Warm the cache
        cache_data: ActionFiltersByWorkflow = {workflow.id: condition_groups}
        cache_keys = self.populate_action_filter_cache(cache_data)

        # ensure a new condition is created correctly
        new_condition = self.create_data_condition()
        assert isinstance(new_condition, DataCondition)

        # validate the previously cached data is intact
        cached_value = self.get_data_from_cache(cache_keys)[workflow.id]
        assert cached_value == cache_data[workflow.id]

    def test_multiple_groups__update_one_condition(self) -> None:
        workflow = self.create_workflow()
        condition_groups = self.create_action_filters_for_workflow(workflow=workflow, num_filters=2)
        new_condition = self.create_data_condition(condition_group=condition_groups[0])

        # Warm the cache
        cache_keys = self.populate_action_filter_cache({workflow.id: condition_groups})

        # create a second set of filters and trigger the receiver
        new_condition.name = "Test Model Change"
        new_condition.save()

        assert self.get_data_from_cache(cache_keys)[workflow.id] is None

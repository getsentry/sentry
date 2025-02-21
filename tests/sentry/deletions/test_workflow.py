import pytest

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin

# from tests.sentry.workflow_engine.test_base import BaseWorkflowTest
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
class TestDeleteWorkflow(HybridCloudTestMixin):
    def tasks(self):
        return TaskRunner()

    @pytest.fixture(autouse=True)
    def setUp(self):
        self.organization = Factories.create_organization()
        self.project = Factories.create_project(organization=self.organization)

        self.workflow = Factories.create_workflow()
        self.workflow_trigger = Factories.create_data_condition_group(
            organization=self.organization
        )
        self.workflow.when_condition_group = self.workflow_trigger
        self.workflow.save()

        self.action_filter = Factories.create_data_condition_group(organization=self.organization)
        self.action = Factories.create_action()
        self.action_and_filter = Factories.create_data_condition_group_action(
            condition_group=self.action_filter,
            action=self.action,
        )

        self.workflow_actions = Factories.create_workflow_data_condition_group(
            workflow=self.workflow,
            condition_group=self.action_filter,
        )

        self.trigger_condition = Factories.create_data_condition(
            condition_group=self.workflow_trigger,
            comparison=1,
            condition_result=True,
        )

        self.action_condition = Factories.create_data_condition(
            condition_group=self.action_filter,
            comparison=1,
            condition_result=True,
        )

    @pytest.mark.parametrize(
        "instance_attr",
        [
            "workflow",
            "workflow_trigger",
            "action_filter",
            "action_and_filter",
            "workflow_actions",
            "trigger_condition",
            "action_condition",
        ],
    )
    def test_delete_workflow(self, instance_attr):
        instance = getattr(self, instance_attr)
        instance_id = instance.id
        cls = instance.__class__

        self.ScheduledDeletion.schedule(instance=self.workflow, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not cls.objects.filter(id=instance_id).exists()

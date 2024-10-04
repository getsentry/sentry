from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Action, DataConditionGroup
from sentry.workflow_engine.process import process_workflow


class TestWorkflowCase(TestCase):
    def create_workflow_case(self):
        self.workflow = self.create_workflow(organization=self.organization)

        when_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY,
            organization=self.organization,
        )

        self.create_data_condition(
            condition="eq",
            comparison="critical",
            type="WorkflowCondition",
            condition_result="True",
            condition_group=when_condition_group,
        )

        send_notification_action = self.create_action(type=Action.Type.Notification, data="")

        self.create_data_condition_group_action(
            action=send_notification_action,
            condition_group=when_condition_group,
        )

        self.detector = self.create_detector(organization=self.organization)
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)


class TestProcessWorkflow(TestWorkflowCase):
    def setUp(self):
        super().setUp()
        self.create_workflow_case()

    def test_process_workflow(self):
        packet = {"query_id": 1}
        process_workflow(packet, [self.detector])


class TestProcessWorkflows(TestWorkflowCase):
    def setUp(self):
        super().setUp()
        # figure out the create stuff

    # process_workflows -- simplez

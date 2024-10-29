from sentry.testutils.cases import TestCase
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import (  # DetectorStatus,
    Action,
    DataConditionGroup,
    DataPacket,
    DetectorEvaluationResult,
    DetectorStateData,
)
from sentry.workflow_engine.processors import process_workflows
from sentry.workflow_engine.registries.condition_registry import DataConditionType


class TestWorkflowCase(TestCase):
    def create_workflow_case(self):
        self.when_condition_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY,
            organization=self.organization,
        )

        self.detector_result = DetectorEvaluationResult(
            is_active=True,
            priority=PriorityLevel.LOW,
            data={"bar": "baz"},
            state_update_data=DetectorStateData(
                group_key=None,
                active=True,
                status=PriorityLevel.LOW,
                dedupe_value=0,
                counter_updates={},
            ),
        )

        self.create_data_condition(
            condition=DataConditionType.EQ,
            comparison=getattr(self.detector_result.state_update_data, "status", PriorityLevel.OK),
            type="WorkflowWhenCondition",  # TODO - Add this to the deafult enum
            condition_result=True,
            condition_group=self.when_condition_group,
        )

        self.send_notification_action = self.create_action(
            type=Action.Type.Notification,
            data="{'baz': 'qux'}",
        )

        self.create_data_condition_group_action(
            action=self.send_notification_action,
            condition_group=self.when_condition_group,
        )

        self.workflow = self.create_workflow(
            organization=self.organization,
            when_condition_group=self.when_condition_group,
        )

        self.detector = self.create_detector(organization=self.organization)
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)

    def setUp(self):
        super().setUp()
        self.create_workflow_case()

    def test_process_workflow(self):
        packet = DataPacket[dict]("source_id", {"source_id": 1, "foo": "bar"})

        # result = process_workflows(packet, [(self.detector, [self.detector_result])])
        triggered_workflows = process_workflows(packet, [(self.detector, [self.detector_result])])

        assert len(triggered_workflows) == 1
        assert triggered_workflows[self.workflow] == [(self.detector, [self.detector_result])]

    def test_process_workflow_no_trigger__no_data_condition_matching(self):
        packet = DataPacket[dict]("source_id", {"source_id": 1, "foo": "bar"})

        detector_result = DetectorEvaluationResult(
            is_active=True,
            priority=PriorityLevel.OK,
            data={"bar": "baz"},
            state_update_data=DetectorStateData(
                group_key=None,
                active=True,
                status=PriorityLevel.OK,
                dedupe_value=0,
                counter_updates={},
            ),
        )

        triggered_workflows = process_workflows(packet, [(self.detector, [detector_result])])
        assert len(triggered_workflows) == 0

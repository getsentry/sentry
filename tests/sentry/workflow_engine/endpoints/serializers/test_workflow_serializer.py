from datetime import timedelta

from sentry.api.serializers import serialize
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import Action, DataConditionGroup, WorkflowFireHistory
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_snuba]


class TestWorkflowSerializer(TestCase):
    def test_serialize_simple(self) -> None:
        workflow = self.create_workflow(
            name="hojicha",
            organization_id=self.organization.id,
            config={},
        )

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "name": str(workflow.name),
            "organizationId": str(self.organization.id),
            "config": {},
            "createdBy": None,
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggers": None,
            "actionFilters": [],
            "environment": None,
            "detectorIds": [],
            "enabled": workflow.enabled,
            "lastTriggered": None,
        }

    def test_serialize_full(self) -> None:
        when_condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        trigger_condition = self.create_data_condition(
            condition_group=when_condition_group,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        workflow = self.create_workflow(
            name="hojicha",
            organization_id=self.organization.id,
            config={},
            when_condition_group=when_condition_group,
            environment=self.environment,
            created_by_id=self.user.id,
        )

        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ALL,
        )
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={
                "target_identifier": "123",
                "target_type": ActionTarget.USER.value,
            },
        )
        self.create_data_condition_group_action(condition_group=condition_group, action=action)
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.create_workflow_data_condition_group(
            condition_group=condition_group,
            workflow=workflow,
        )

        detector = self.create_detector()
        self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        history = WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            event_id=self.event.event_id,
        )
        # Too old, shouldn't be used.
        WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            event_id=self.event.event_id,
        )
        history.date_added = workflow.date_added + timedelta(seconds=1)
        history.save()

        result = serialize(workflow)

        assert result == {
            "id": str(workflow.id),
            "name": str(workflow.name),
            "organizationId": str(self.organization.id),
            "config": {},
            "createdBy": str(self.user.id),
            "dateCreated": workflow.date_added,
            "dateUpdated": workflow.date_updated,
            "triggers": {
                "id": str(when_condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY.value,
                "conditions": [
                    {
                        "id": str(trigger_condition.id),
                        "type": "first_seen_event",
                        "comparison": True,
                        "conditionResult": True,
                    }
                ],
                "actions": [],
            },
            "actionFilters": [
                {
                    "id": str(condition_group.id),
                    "organizationId": str(self.organization.id),
                    "logicType": DataConditionGroup.Type.ALL.value,
                    "conditions": [
                        {
                            "id": str(condition.id),
                            "type": "gt",
                            "comparison": 100,
                            "conditionResult": DetectorPriorityLevel.HIGH.value,
                        }
                    ],
                    "actions": [
                        {
                            "id": str(action.id),
                            "type": "email",
                            "data": {},
                            "integrationId": None,
                            "config": {"targetType": "user", "targetIdentifier": "123"},
                            "status": "active",
                        }
                    ],
                },
            ],
            "environment": self.environment.name,
            "detectorIds": [str(detector.id)],
            "enabled": workflow.enabled,
            "lastTriggered": history.date_added,
        }

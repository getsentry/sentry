from typing import int
from sentry.api.serializers import serialize
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import Action, DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_snuba]


class TestDataConditionGroupSerializer(TestCase):
    def test_serialize_simple(self) -> None:
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [],
            "actions": [],
        }

    def test_serialize_full(self) -> None:
        condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
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

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [
                {
                    "id": str(condition.id),
                    "type": "gt",
                    "comparison": 100,
                    "conditionResult": DetectorPriorityLevel.HIGH,
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
        }

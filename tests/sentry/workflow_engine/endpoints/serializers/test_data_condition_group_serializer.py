from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.endpoints.serializers.data_condition_group_serializer import (
    DataConditionGroupSerializer,
)
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

    def test_serialize_bulk_queries_one(self) -> None:
        self._assert_serialize_bulk_queries(1)

    def test_serialize_bulk_queries_three(self) -> None:
        self._assert_serialize_bulk_queries(3)

    def _assert_serialize_bulk_queries(self, group_count: int) -> None:
        shared_action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={"target_identifier": "123", "target_type": ActionTarget.USER.value},
        )
        shared_action_data = {
            "id": str(shared_action.id),
            "type": "email",
            "data": {},
            "integrationId": None,
            "config": {"targetType": "user", "targetIdentifier": "123"},
            "status": "active",
        }
        groups = []
        expected = []
        for _ in range(group_count):
            group = self.create_data_condition_group(organization=self.organization)
            groups.append(group)
            action = self.create_action(
                type=Action.Type.EMAIL,
                data={},
                config={"target_identifier": "456", "target_type": ActionTarget.USER.value},
            )
            self.create_data_condition_group_action(condition_group=group, action=shared_action)
            self.create_data_condition_group_action(condition_group=group, action=action)
            expected.append(
                {
                    "id": str(group.id),
                    "organizationId": str(self.organization.id),
                    "logicType": group.logic_type,
                    "conditions": [],
                    "actions": [
                        shared_action_data,
                        {
                            **shared_action_data,
                            "id": str(action.id),
                            "config": {"targetType": "user", "targetIdentifier": "456"},
                        },
                    ],
                }
            )

        groups = list(
            DataConditionGroup.objects.filter(id__in=[g.id for g in groups]).order_by("id")
        )
        serializer = DataConditionGroupSerializer()
        connection = connections[router.db_for_read(DataConditionGroup)]
        with CaptureQueriesContext(connection) as queries:
            attrs = serializer.get_attrs(groups, self.user)
        assert len(queries) == 2

        with CaptureQueriesContext(connection) as queries:
            result = [serializer.serialize(group, attrs[group], self.user) for group in groups]
        assert len(queries) == 0
        assert result == expected

    def test_serialize_linked_pending_deletion_action(self) -> None:
        self._assert_serialize_linked_action_uses_base_manager(ObjectStatus.PENDING_DELETION)

    def test_serialize_linked_deletion_in_progress_action(self) -> None:
        self._assert_serialize_linked_action_uses_base_manager(ObjectStatus.DELETION_IN_PROGRESS)

    def _assert_serialize_linked_action_uses_base_manager(self, status: int) -> None:
        group = self.create_data_condition_group(organization=self.organization)
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={"target_identifier": "123", "target_type": ActionTarget.USER.value},
            status=status,
        )
        self.create_data_condition_group_action(condition_group=group, action=action)
        self.create_data_condition_group_action(condition_group=group, action=action)

        assert not Action.objects.filter(id=action.id).exists()
        group = DataConditionGroup.objects.get(id=group.id)
        action_data = {
            "id": str(action.id),
            "type": "email",
            "data": {},
            "integrationId": None,
            "config": {"targetType": "user", "targetIdentifier": "123"},
            "status": action.get_status_display(),
        }
        assert serialize(group) == {
            "id": str(group.id),
            "organizationId": str(self.organization.id),
            "logicType": group.logic_type,
            "conditions": [],
            "actions": [action_data, action_data],
        }

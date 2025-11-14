from typing import int
from sentry.api.serializers import serialize
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = [requires_snuba]


class TestDataConditionSerializer(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.condition_group = self.create_data_condition_group(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )

    def test_serializer_simple(self) -> None:
        condition = self.create_data_condition(
            condition_group=self.condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        result = serialize(condition)

        assert result == {
            "id": str(condition.id),
            "type": "gt",
            "comparison": 100,
            "conditionResult": DetectorPriorityLevel.HIGH,
        }

    def test_complex_comparison(self) -> None:
        condition = self.create_data_condition(
            condition_group=self.condition_group,
            type=Condition.GREATER,
            comparison={"count": 100, "count_time": 60},
            condition_result=DetectorPriorityLevel.HIGH,
        )
        result = serialize(condition)

        assert result == {
            "id": str(condition.id),
            "type": "gt",
            "comparison": {"count": 100, "countTime": 60},
            "conditionResult": DetectorPriorityLevel.HIGH,
        }

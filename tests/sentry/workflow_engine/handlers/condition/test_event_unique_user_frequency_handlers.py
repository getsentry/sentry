from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventUniqueUserFrequencyCondition,
)
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_event_frequency_handlers import (
    TestEventFrequencyCountCondition,
    TestEventFrequencyPercentCondition,
)


class TestEventUniqueUserFrequencyCountCondition(TestEventFrequencyCountCondition):
    condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT
    payload = {
        "interval": "1h",
        "id": EventUniqueUserFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.COUNT,
    }


class TestEventUniqueUserFrequencyPercentCondition(TestEventFrequencyPercentCondition):
    condition = Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT
    payload = {
        "interval": "1h",
        "id": EventUniqueUserFrequencyCondition.id,
        "value": 1000,
        "comparisonType": ComparisonType.PERCENT,
        "comparisonInterval": "1d",
    }

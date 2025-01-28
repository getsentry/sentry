from datetime import datetime
from enum import Enum
from typing import Any, TypedDict


class QuerySubscriptionUpdate(TypedDict):
    entity: str
    subscription_id: str
    values: Any
    timestamp: datetime


class AlertRuleActivationConditionType(Enum):
    RELEASE_CREATION = 0
    DEPLOY_CREATION = 1


DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION = "snuba_query_subscription"

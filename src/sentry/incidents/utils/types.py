from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, TypedDict


@dataclass
class AnomalyDetectionValues:
    value: float
    source_id: str
    subscription_id: str
    timestamp: datetime


class SubscriptionUpdateValues(TypedDict):
    value: float


class QuerySubscriptionUpdateValues(TypedDict):
    data: list[dict[str, Any]]


class QuerySubscriptionUpdate(TypedDict):
    entity: str
    subscription_id: str
    values: QuerySubscriptionUpdateValues
    timestamp: datetime


@dataclass
class ProcessedSubscriptionUpdate:
    entity: str
    subscription_id: str
    values: SubscriptionUpdateValues
    timestamp: datetime


@dataclass
class AnomalyDetectionUpdate:
    entity: str
    subscription_id: str
    values: AnomalyDetectionValues
    timestamp: datetime


class AlertRuleActivationConditionType(Enum):
    RELEASE_CREATION = 0
    DEPLOY_CREATION = 1


DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION = "snuba_query_subscription"

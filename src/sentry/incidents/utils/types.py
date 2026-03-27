from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict


class QuerySubscriptionUpdateValues(TypedDict):
    data: list[dict[str, Any]]


class QuerySubscriptionUpdate(TypedDict):
    entity: str
    subscription_id: str
    values: QuerySubscriptionUpdateValues
    timestamp: datetime


class SubscriptionUpdateValues(TypedDict):
    value: float


@dataclass
class ProcessedSubscriptionUpdate:
    entity: str
    subscription_id: str
    values: SubscriptionUpdateValues
    timestamp: datetime


class AnomalyDetectionValues(TypedDict):
    value: float
    source_id: str
    subscription_id: str
    timestamp: datetime


@dataclass
class AnomalyDetectionUpdate:
    entity: str
    subscription_id: str
    values: AnomalyDetectionValues
    timestamp: datetime


DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION = "snuba_query_subscription"

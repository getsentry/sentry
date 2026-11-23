from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

# TODO: Remove this re-export once getsentry imports the constant from
# `sentry.incidents.utils.constants`.
from sentry.incidents.utils.constants import (
    DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION as DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
)


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

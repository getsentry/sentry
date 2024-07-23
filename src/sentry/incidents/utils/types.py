from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, TypedDict


@dataclass
class MetaType:
    name: str
    type: str


@dataclass
class QuerySubscriptionUpdateValues:
    data: list[dict[str, Any]]  # depends on query, typically {count: int}
    meta: list[MetaType]
    profile: dict[str, Any]
    quota_allowance: dict[str, Any]
    timing: dict[str, Any]
    trace_output: str


class QuerySubscriptionUpdate(TypedDict):
    entity: str
    subscription_id: str
    values: QuerySubscriptionUpdateValues
    timestamp: datetime


class AlertRuleActivationConditionType(Enum):
    RELEASE_CREATION = 0
    DEPLOY_CREATION = 1

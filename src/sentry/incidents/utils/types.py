from datetime import datetime
from typing import Any, TypedDict


class QuerySubscriptionUpdate(TypedDict):
    entity: str
    subscription_id: str
    values: Any
    timestamp: datetime

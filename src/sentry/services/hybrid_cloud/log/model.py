# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
from typing import Any, Mapping, Optional

from sentry.services.hybrid_cloud import DEFAULT_DATE, RpcModel


class UserIpEvent(RpcModel):
    user_id: int = -1
    ip_address: str = "127.0.0.1"
    last_seen: datetime.datetime = DEFAULT_DATE
    country_code: Optional[str] = None
    region_code: Optional[str] = None


class AuditLogEvent(RpcModel):
    organization_id: int = -1
    # 'datetime' is apparently reserved attribute name for dataclasses.
    date_added: datetime.datetime = DEFAULT_DATE
    event_id: int = -1
    actor_label: Optional[str] = None
    actor_user_id: Optional[int] = None
    actor_key_id: Optional[int] = None
    ip_address: Optional[str] = None
    target_object_id: Optional[int] = None
    data: Optional[Mapping[str, Any]] = None
    target_user_id: Optional[int] = None

# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
from collections.abc import Mapping
from typing import Any

from sentry.hybridcloud.rpc import DEFAULT_DATE, RpcModel


class UserIpEvent(RpcModel):
    user_id: int = -1
    ip_address: str = "127.0.0.1"
    last_seen: datetime.datetime = DEFAULT_DATE
    country_code: str | None = None
    region_code: str | None = None


class AuditLogEvent(RpcModel):
    organization_id: int = -1
    # 'datetime' is apparently reserved attribute name for dataclasses.
    date_added: datetime.datetime = DEFAULT_DATE
    event_id: int = -1
    actor_label: str | None = None
    actor_user_id: int | None = None
    actor_key_id: int | None = None
    ip_address: str | None = None
    target_object_id: int | None = None
    data: Mapping[str, Any] | None = None
    target_user_id: int | None = None

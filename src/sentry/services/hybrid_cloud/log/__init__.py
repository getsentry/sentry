# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc
import datetime
from typing import Any, Mapping, Optional

from sentry.services.hybrid_cloud import (
    DEFAULT_DATE,
    InterfaceWithLifecycle,
    RpcModel,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


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
    actor_label: str = ""
    actor_user_id: Optional[int] = None
    ip_address: Optional[str] = None
    target_object_id: Optional[int] = None
    data: Optional[Mapping[str, Any]] = None
    target_user_id: Optional[int] = None


class LogService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def close(self) -> None:
        pass

    @abc.abstractmethod
    def record_audit_log(self, *, event: AuditLogEvent) -> None:
        pass

    @abc.abstractmethod
    def record_user_ip(self, *, event: UserIpEvent) -> None:
        pass


def impl_by_db() -> LogService:
    from .impl import DatabaseBackedLogService

    return DatabaseBackedLogService()


def impl_by_outbox() -> LogService:
    from .impl import OutboxBackedLogService

    return OutboxBackedLogService()


log_service = silo_mode_delegation(
    {
        SiloMode.REGION: impl_by_outbox,
        SiloMode.CONTROL: impl_by_db,
        SiloMode.MONOLITH: impl_by_db,
    }
)

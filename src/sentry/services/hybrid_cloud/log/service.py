# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import abc

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation
from sentry.services.hybrid_cloud.log import AuditLogEvent, UserIpEvent
from sentry.silo import SiloMode


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

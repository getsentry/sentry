from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any, Mapping

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.auth import ApiAuthIdentity, ApiAuthProvider
from sentry.services.hybrid_cloud.organization import ApiOrganization, ApiOrganizationMember
from sentry.services.hybrid_cloud.user import APIUser
from sentry.silo import SiloMode


@dataclass
class AuditLogMetadata:
    organization: ApiOrganization
    event: int
    actor_label: str | None = None
    actor: APIUser | None = None
    ip_address: str | None = None
    target_object: int | None = None
    target_user: APIUser | None = None


class AuditLogService(InterfaceWithLifecycle):
    @abc.abstractmethod
    def write_audit_log(
        self,
        *,
        metadata: AuditLogMetadata,
        data: Mapping[str, Any],
    ) -> None:
        raise NotImplementedError

    @abc.abstractmethod
    def log_organization_membership(
        self,
        *,
        metadata: AuditLogMetadata,
        organization_member: ApiOrganizationMember,
    ) -> None:
        raise NotImplementedError

    @abc.abstractmethod
    def log_auth_provider(
        self,
        *,
        metadata: AuditLogMetadata,
        provider: ApiAuthProvider,
    ) -> None:
        raise NotImplementedError

    @abc.abstractmethod
    def log_auth_identity(
        self,
        *,
        metadata: AuditLogMetadata,
        auth_identity: ApiAuthIdentity,
    ) -> None:
        raise NotImplementedError

    def close(self) -> None:
        pass


def impl_with_db() -> AuditLogService:
    from sentry.services.hybrid_cloud.audit.impl import DatabaseBackedAuditLogService

    return DatabaseBackedAuditLogService()


audit_log_service: AuditLogService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.CONTROL: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
    }
)

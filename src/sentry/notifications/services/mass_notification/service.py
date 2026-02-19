# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from abc import abstractmethod

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.notifications.services.mass_notification.model import RpcMassNotificationResult
from sentry.silo.base import SiloMode


class MassNotificationService(RpcService):
    key = "mass_notification"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.notifications.services.mass_notification.impl import (
            DatabaseBackedMassNotificationService,
        )

        return DatabaseBackedMassNotificationService()

    @rpc_method
    @abstractmethod
    def mass_notify_by_integration(
        self,
        *,
        integration_id: int,
        message: str,
    ) -> RpcMassNotificationResult:
        pass

    @rpc_method
    @abstractmethod
    def mass_notify_by_user_organizations(
        self,
        *,
        user_id: int,
        message: str,
    ) -> RpcMassNotificationResult:
        pass

    @rpc_method
    @abstractmethod
    def mass_notify_by_vibes(
        self,
        *,
        organization_id: int,
        message: str,
        vibe: str,
    ) -> RpcMassNotificationResult:
        pass


mass_notification_service = MassNotificationService.create_delegation()

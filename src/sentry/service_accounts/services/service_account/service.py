# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.silo.base import SiloMode


class ServiceAccountService(RpcService):
    key = "service_account"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.service_accounts.services.service_account.impl import (
            DatabaseBackedServiceAccountService,
        )

        return DatabaseBackedServiceAccountService()

    @rpc_method
    @abstractmethod
    def remove_project_links_outside_org(self, *, project_id: int, organization_id: int) -> None:
        """
        Deletes links to `project_id` from service accounts that don't belong to
        `organization_id`, the project's current org. Called after a project transfer.
        """


service_account_service = ServiceAccountService.create_delegation()

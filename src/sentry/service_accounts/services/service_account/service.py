# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from datetime import datetime

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
    def remove_project_links_after_transfer(
        self,
        *,
        project_id: int,
        organization_id: int,
        previous_organization_id: int,
        transferred_at: datetime,
    ) -> None:
        """
        Called after `project_id` moves out of `previous_organization_id`. Deletes its links
        from accounts outside `organization_id`, the project's current org, and from
        `previous_organization_id` accounts linked before `transferred_at`. The second case
        covers a project that came back to that org before this ran.
        """


service_account_service = ServiceAccountService.create_delegation()

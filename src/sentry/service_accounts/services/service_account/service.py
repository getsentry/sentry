# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from datetime import datetime

from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.service_accounts.services.service_account.model import RpcServiceAccount
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

    @rpc_method
    @abstractmethod
    def get_service_account(
        self, *, organization_id: int, service_account_id: int
    ) -> RpcServiceAccount | None:
        """Returns None when the account isn't in `organization_id` or was deleted."""

    @rpc_method
    @abstractmethod
    def create_service_account(
        self,
        *,
        organization_id: int,
        name: str,
        scope_list: list[str],
        project_ids: list[int],
        all_projects: bool,
        created_by_id: int | None,
        idempotency_key: str | None = None,
    ) -> RpcServiceAccount:
        """
        `scope_list` must not be empty, `name` must be at most `MAX_NAME_LENGTH` characters,
        and `project_ids` must be projects in `organization_id`. None of these are checked
        here. Callers must authorize the grant and write the audit log.

        When `idempotency_key` matches an account in `organization_id`, that account is
        returned unchanged instead of creating another.
        """

    @rpc_method
    @abstractmethod
    def update_service_account(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        scope_list: list[str],
        project_ids: list[int],
        all_projects: bool,
    ) -> RpcServiceAccount | None:
        """
        Replace an account's scopes and projects. Returns None when the account isn't in
        `organization_id` or was deleted. `scope_list` must not be empty and `project_ids`
        must be projects in `organization_id`; neither is checked here. Callers must
        authorize the grant and write the audit log.
        """

    @rpc_method
    @abstractmethod
    def delete_service_account(self, *, organization_id: int, service_account_id: int) -> None:
        """
        Soft-delete the account: keep the row, turn it off for good and remove its project
        links. Does nothing when the account isn't in `organization_id` or was already
        deleted. Callers must write the audit log.
        """


service_account_service = ServiceAccountService.create_delegation()

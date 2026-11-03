from __future__ import annotations

from datetime import datetime

from django.db import router, transaction
from django.db.models import Q

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.service_accounts.models import ServiceAccount, ServiceAccountProject
from sentry.service_accounts.services.service_account.model import RpcServiceAccount
from sentry.service_accounts.services.service_account.serial import serialize_service_account
from sentry.service_accounts.services.service_account.service import ServiceAccountService


class DatabaseBackedServiceAccountService(ServiceAccountService):
    def remove_project_links_after_transfer(
        self,
        *,
        project_id: int,
        organization_id: int,
        previous_organization_id: int,
        transferred_at: datetime,
    ) -> None:
        links = (
            ServiceAccountProject.objects.filter(project_id=project_id)
            .filter(
                ~Q(service_account__organization_id=organization_id)
                | Q(
                    service_account__organization_id=previous_organization_id,
                    date_added__lte=transferred_at,
                )
            )
            .select_related("service_account")
        )
        # Deleting one at a time writes each account's outbox, so its replica updates too.
        for link in links:
            link.delete()

    def get_service_account(
        self, *, organization_id: int, service_account_id: int
    ) -> RpcServiceAccount | None:
        service_account = ServiceAccount.objects.filter(
            id=service_account_id, organization_id=organization_id
        ).first()
        if service_account is None:
            return None
        project_ids = ServiceAccountProject.objects.filter(
            service_account=service_account
        ).values_list("project_id", flat=True)
        return serialize_service_account(service_account, project_ids)

    def create_service_account(
        self,
        *,
        organization_id: int,
        name: str,
        scope_list: list[str],
        project_ids: list[int],
        all_projects: bool,
        created_by_id: int | None,
    ) -> RpcServiceAccount:
        with outbox_context(transaction.atomic(using=router.db_for_write(ServiceAccount))):
            service_account = ServiceAccount.objects.create(
                organization_id=organization_id,
                name=name,
                scope_list=scope_list,
                all_projects=all_projects,
                created_by_id=created_by_id,
            )
            service_account.replace_projects([] if all_projects else project_ids)
        return serialize_service_account(service_account, [] if all_projects else project_ids)

    def update_service_account(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        scope_list: list[str],
        project_ids: list[int],
        all_projects: bool,
    ) -> RpcServiceAccount | None:
        with outbox_context(transaction.atomic(using=router.db_for_write(ServiceAccount))):
            service_account = (
                ServiceAccount.objects.select_for_update()
                .filter(id=service_account_id, organization_id=organization_id)
                .first()
            )
            if service_account is None:
                return None
            service_account.scope_list = scope_list
            service_account.all_projects = all_projects
            service_account.replace_projects([] if all_projects else project_ids)
            service_account.save()
        return serialize_service_account(service_account, [] if all_projects else project_ids)

    def delete_service_account(self, *, organization_id: int, service_account_id: int) -> None:
        service_account = ServiceAccount.objects.filter(
            id=service_account_id, organization_id=organization_id
        ).first()
        if service_account is not None:
            service_account.delete()

from __future__ import annotations

from datetime import datetime

from django.db import IntegrityError, router, transaction
from django.db.models import Q

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.hybridcloud.rpc.service import RpcValidationException
from sentry.service_accounts.models import (
    InvalidScopeError,
    ServiceAccount,
    ServiceAccountProject,
    validate_grantable_scopes,
)
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
            id=service_account_id, organization_id=organization_id, is_active=True
        ).first()
        if service_account is None:
            return None
        return _serialize_with_projects(service_account)

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
        if idempotency_key is not None:
            existing = self._get_by_idempotency_key(organization_id, idempotency_key)
            if existing is not None:
                return existing
        try:
            service_account = ServiceAccount.create_with_projects(
                organization_id=organization_id,
                name=name,
                scope_list=scope_list,
                project_ids=project_ids,
                all_projects=all_projects,
                created_by_id=created_by_id,
                idempotency_key=idempotency_key,
            )
        except InvalidScopeError as e:
            raise RpcValidationException(
                detail=" ".join(e.messages),
                code="invalid_scope",
                service_name="service_account",
                method_name="create_service_account",
            ) from e
        except IntegrityError as e:
            # A concurrent create with the same key won the race.
            if idempotency_key is not None:
                existing = self._get_by_idempotency_key(organization_id, idempotency_key)
                if existing is not None:
                    return existing
            # TODO: Only catch the name unique constraint.
            raise RpcValidationException(
                detail=f"A service account named '{name}' already exists.",
                code="duplicate_name",
                service_name="service_account",
                method_name="create_service_account",
            ) from e
        return serialize_service_account(
            service_account, set() if all_projects else set(project_ids)
        )

    def _get_by_idempotency_key(
        self, organization_id: int, idempotency_key: str
    ) -> RpcServiceAccount | None:
        service_account = ServiceAccount.objects.filter(
            organization_id=organization_id, idempotency_key=idempotency_key
        ).first()
        if service_account is None:
            return None
        return _serialize_with_projects(service_account)

    def update_service_account(
        self,
        *,
        organization_id: int,
        service_account_id: int,
        scope_list: list[str],
        project_ids: list[int],
        all_projects: bool,
    ) -> RpcServiceAccount | None:
        try:
            validate_grantable_scopes(scope_list)
        except InvalidScopeError as e:
            raise RpcValidationException(
                detail=" ".join(e.messages),
                code="invalid_scope",
                service_name="service_account",
                method_name="update_service_account",
            ) from e
        with outbox_context(transaction.atomic(using=router.db_for_write(ServiceAccount))):
            service_account = (
                ServiceAccount.objects.select_for_update()
                .filter(id=service_account_id, organization_id=organization_id, is_active=True)
                .first()
            )
            if service_account is None:
                return None
            service_account.scope_list = scope_list
            service_account.all_projects = all_projects
            service_account.replace_projects([] if all_projects else project_ids)
            service_account.save()
        return serialize_service_account(
            service_account, set() if all_projects else set(project_ids)
        )

    def delete_service_account(self, *, organization_id: int, service_account_id: int) -> None:
        service_account = ServiceAccount.objects.filter(
            id=service_account_id, organization_id=organization_id
        ).first()
        if service_account is not None:
            service_account.deactivate()


def _serialize_with_projects(service_account: ServiceAccount) -> RpcServiceAccount:
    project_ids = ServiceAccountProject.objects.filter(service_account=service_account).values_list(
        "project_id", flat=True
    )
    return serialize_service_account(service_account, project_ids)

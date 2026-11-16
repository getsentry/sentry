"""
Create or update a service account from a cell in the same transaction as the cell object that
owns it.

Save ``service_account_create_outbox(...)`` in the owner's transaction. The outbox creates the
account in control and calls the owner's ``link_service_account``. Add a
``ServiceAccountOwnerKind`` and map it in ``receivers/outbox/cell.py`` for each new owner.

Save ``service_account_grant_update_outbox(...)`` in the owner's transaction to replace an
account's scopes and projects.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from enum import StrEnum
from typing import Protocol, TypedDict
from uuid import uuid4

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.hybridcloud.rpc.service import RpcValidationException
from sentry.service_accounts.services.service_account import service_account_service

logger = logging.getLogger(__name__)


class ServiceAccountOwnerKind(StrEnum):
    SEER_WORKFLOW_CONFIG = "seer_workflow_config"


class ServiceAccountCreatePayload(TypedDict):
    """Outbox payload for SERVICE_ACCOUNT_CREATE. Shared by producer and receiver."""

    owner_kind: str
    owner_id: int
    name: str
    scope_list: list[str]
    project_ids: list[int]
    all_projects: bool
    created_by_id: int | None
    idempotency_key: str


class ServiceAccountGrantUpdatePayload(TypedDict):
    """Outbox payload for SERVICE_ACCOUNT_GRANT_UPDATE. Shared by producer and receiver."""

    scope_list: list[str]
    project_ids: list[int]
    all_projects: bool


class ServiceAccountOwner(Protocol):
    def needs_service_account(self, organization_id: int, owner_id: int) -> bool:
        """False when the owner was deleted or already linked, so no account is created."""
        ...

    def link_service_account(
        self, organization_id: int, owner_id: int, service_account_id: int
    ) -> None:
        """Must be safe to call again for the same account."""
        ...


def service_account_create_outbox(
    *,
    organization_id: int,
    owner_kind: ServiceAccountOwnerKind,
    owner_id: int,
    name: str,
    scope_list: Sequence[str],
    project_ids: Sequence[int] = (),
    all_projects: bool = False,
    created_by_id: int | None = None,
) -> CellOutbox:
    """The outbox that creates and links the owner's account; save it in the owner's transaction.

    Callers validate the grant first. Control rejecting it leaves the owner without an account.
    """
    payload: ServiceAccountCreatePayload = {
        "owner_kind": owner_kind.value,
        "owner_id": owner_id,
        "name": name,
        "scope_list": list(scope_list),
        "project_ids": [] if all_projects else list(project_ids),
        "all_projects": all_projects,
        "created_by_id": created_by_id,
        # Stable across redeliveries of this outbox, so control returns the account
        # an earlier attempt created instead of making a second one.
        "idempotency_key": uuid4().hex,
    }
    return CellOutbox(
        shard_scope=OutboxScope.SERVICE_ACCOUNT_SCOPE,
        shard_identifier=organization_id,
        category=OutboxCategory.SERVICE_ACCOUNT_CREATE,
        # Every create is its own message, so creates for different owners never coalesce.
        object_identifier=CellOutbox.next_object_identifier(),
        payload=payload,
    )


def create_owned_service_account(
    organization_id: int, payload: ServiceAccountCreatePayload, owner: ServiceAccountOwner
) -> None:
    """Create the account in control and link it to its owner. Safe to retry."""
    owner_id = payload["owner_id"]
    if not owner.needs_service_account(organization_id, owner_id):
        return

    try:
        account = service_account_service.create_service_account(
            organization_id=organization_id,
            name=payload["name"],
            scope_list=payload["scope_list"],
            project_ids=payload["project_ids"],
            all_projects=payload["all_projects"],
            created_by_id=payload["created_by_id"],
            idempotency_key=payload["idempotency_key"],
        )
    except RpcValidationException:
        # Retrying can't fix a rejected grant, and raising would stall the org's shard.
        logger.exception(
            "service_accounts.outbox_create.rejected",
            extra={
                "organization_id": organization_id,
                "owner_kind": payload["owner_kind"],
                "owner_id": owner_id,
            },
        )
        return

    owner.link_service_account(organization_id, owner_id, account.id)


def service_account_grant_update_outbox(
    *,
    organization_id: int,
    service_account_id: int,
    scope_list: Sequence[str],
    project_ids: Sequence[int] = (),
    all_projects: bool = False,
) -> CellOutbox:
    """The outbox that replaces an account's scopes and projects.

    Save it in the owner's transaction. Callers validate the grant first. Updates to one account
    coalesce, so only the latest grant is applied. A deleted account is left as it is.
    """
    payload: ServiceAccountGrantUpdatePayload = {
        "scope_list": list(scope_list),
        "project_ids": [] if all_projects else list(project_ids),
        "all_projects": all_projects,
    }
    return CellOutbox(
        shard_scope=OutboxScope.SERVICE_ACCOUNT_SCOPE,
        shard_identifier=organization_id,
        category=OutboxCategory.SERVICE_ACCOUNT_GRANT_UPDATE,
        object_identifier=service_account_id,
        payload=payload,
    )


def update_service_account_grant(
    organization_id: int, service_account_id: int, payload: ServiceAccountGrantUpdatePayload
) -> None:
    """Replace the account's scopes and projects in control. Safe to retry."""
    try:
        service_account_service.update_service_account(
            organization_id=organization_id,
            service_account_id=service_account_id,
            scope_list=payload["scope_list"],
            project_ids=payload["project_ids"],
            all_projects=payload["all_projects"],
        )
    except RpcValidationException:
        logger.exception(
            "service_accounts.outbox_grant_update.rejected",
            extra={"organization_id": organization_id, "service_account_id": service_account_id},
        )

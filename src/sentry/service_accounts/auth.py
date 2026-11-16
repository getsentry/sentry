from __future__ import annotations

from typing import TypeGuard

from sentry import features
from sentry.auth.services.auth import AuthenticatedToken
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.service_accounts.models import ServiceAccount, ServiceAccountReplica
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.silo.base import SiloMode
from sentry.viewer_context import ActorType, ViewerContext

SERVICE_ACCOUNT_TOKEN_KIND = "service_account"


def is_service_account_auth(auth: object) -> TypeGuard[AuthenticatedToken]:
    return isinstance(auth, AuthenticatedToken) and auth.kind == SERVICE_ACCOUNT_TOKEN_KIND


def authenticate_service_account(
    vc: ViewerContext,
) -> tuple[ServiceAccountPrincipal, AuthenticatedToken] | None:
    """
    Resolve a service-account ViewerContext to its principal and a credential for its
    organization. See ``resolve_service_account``.
    """
    actor = vc.actor
    if (
        actor.type != ActorType.SERVICE_ACCOUNT
        or actor.actor_id is None
        or vc.organization_id is None
    ):
        return None
    return resolve_service_account(actor.actor_id, vc.organization_id)


def resolve_service_account(
    service_account_id: int, organization_id: int
) -> tuple[ServiceAccountPrincipal, AuthenticatedToken] | None:
    """
    Resolve an active service account in an organization to its principal and a credential
    for that organization. Every way of authenticating as a service account goes through
    this, so they all apply the same checks.

    Only for organizations with ``organizations:service-accounts``. The credential carries
    the account's current scopes, read on every request: on control from a read replica of
    the account, elsewhere from the cell replica. Narrowing, disabling or deleting the
    account applies once that replica catches up.
    """
    service_account: ServiceAccount | ServiceAccountReplica | None
    organization: Organization | RpcOrganization | None
    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        service_account = (
            ServiceAccount.objects.using_replica()
            .filter(id=service_account_id, organization_id=organization_id, is_active=True)
            .first()
        )
        if service_account is None:
            return None
        org_context = organization_service.get_organization_by_id(
            id=service_account.organization_id, include_projects=False, include_teams=False
        )
        organization = org_context.organization if org_context is not None else None
    else:
        service_account = ServiceAccountReplica.objects.filter(
            service_account_id=service_account_id, organization_id=organization_id, is_active=True
        ).first()
        if service_account is None:
            return None
        try:
            organization = Organization.objects.get_from_cache(id=service_account.organization_id)
        except Organization.DoesNotExist:
            organization = None
    if organization is None or not features.has("organizations:service-accounts", organization):
        return None

    principal = ServiceAccountPrincipal(
        service_account_id=service_account_id,
        organization_id=service_account.organization_id,
        name=service_account.name,
    )
    token = AuthenticatedToken(
        kind=SERVICE_ACCOUNT_TOKEN_KIND,
        entity_id=service_account_id,
        organization_id=service_account.organization_id,
        scopes=sorted(service_account.scope_list),
    )
    return principal, token

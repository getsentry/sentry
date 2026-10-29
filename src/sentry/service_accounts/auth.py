from __future__ import annotations

from typing import TypeGuard

from sentry.auth.services.auth import AuthenticatedToken
from sentry.service_accounts.models import ServiceAccountReplica
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
    organization.

    The token carries no scopes, so they're read from the cell replica on every
    request. Narrowing, disabling or deleting the account applies once its outbox
    replicates, not when the token expires.
    """
    actor = vc.actor
    if (
        actor.type != ActorType.SERVICE_ACCOUNT
        or actor.actor_id is None
        or vc.organization_id is None
    ):
        return None
    # Only cell endpoints accept these contexts, since the replica is a cell table.
    # Control endpoints would need to read the control-side ServiceAccount instead.
    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        return None

    service_account = ServiceAccountReplica.objects.filter(
        service_account_id=actor.actor_id, organization_id=vc.organization_id, is_active=True
    ).first()
    if service_account is None:
        return None

    principal = ServiceAccountPrincipal(
        service_account_id=service_account.service_account_id,
        organization_id=service_account.organization_id,
        name=service_account.name,
    )
    token = AuthenticatedToken(
        kind=SERVICE_ACCOUNT_TOKEN_KIND,
        entity_id=service_account.service_account_id,
        organization_id=service_account.organization_id,
        scopes=sorted(service_account.scope_list),
    )
    return principal, token

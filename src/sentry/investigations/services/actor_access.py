from __future__ import annotations

from collections.abc import Iterable

from rest_framework.exceptions import PermissionDenied

from sentry.auth.access import ServiceAccountAccess, from_service_account_auth
from sentry.models.organization import Organization
from sentry.notebooks.access import INVESTIGATION_SCOPES, has_investigations_access
from sentry.notebooks.services.notebooks import _validate_project_ids
from sentry.service_accounts.auth import authenticate_service_account
from sentry.viewer_context import Actor, ActorType, ViewerContext


def resolve_investigation_service_account(
    *, organization: Organization, account_id: int | None, project_ids: Iterable[int]
) -> ViewerContext:
    """Resolve the saved account and validate its current investigation project access."""
    context = ViewerContext(
        organization_id=organization.id,
        actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=account_id),
    )
    authenticated = authenticate_service_account(context)
    if authenticated is None:
        raise PermissionDenied
    _, token = authenticated
    access = from_service_account_auth(token, organization.id)
    if (
        not isinstance(access, ServiceAccountAccess)
        or not any(access.has_scope(scope) for scope in INVESTIGATION_SCOPES)
        or not has_investigations_access(organization)
    ):
        raise PermissionDenied

    selected = _validate_project_ids(organization.id, project_ids)
    if selected:
        if not set(selected).issubset(access.accessible_project_ids):
            raise PermissionDenied
    else:
        # The account is already authenticated. An empty selection needs the explicit
        # all-project grant, including access to future projects.
        if not access.has_all_projects:
            raise PermissionDenied
    return context

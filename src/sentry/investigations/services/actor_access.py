from __future__ import annotations

from collections.abc import Iterable

from rest_framework.exceptions import PermissionDenied

from sentry.auth.access import ServiceAccountAccess, from_service_account_auth, from_user
from sentry.models.organization import Organization
from sentry.notebooks.access import (
    NOTEBOOK_SCOPES,
    has_notebooks_access,
    service_account_reaches,
)
from sentry.notebooks.services.notebooks import (
    NotebookValidationError,
    _validate_project_ids,
)
from sentry.service_accounts.auth import authenticate_service_account
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.viewer_context import Actor, ActorId, ActorType, ViewerContext


def user_can_investigate(organization: Organization, user: RpcUser | None) -> bool:
    """Open membership gives a member with an investigation scope every active project."""
    access = from_user(user, organization=organization)
    return any(access.has_scope(scope) for scope in NOTEBOOK_SCOPES) and (
        has_notebooks_access(organization, actor=user)
    )


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
        or not any(access.has_scope(scope) for scope in NOTEBOOK_SCOPES)
        or not has_notebooks_access(organization)
    ):
        raise PermissionDenied

    if not service_account_reaches(access, _validate_project_ids(organization.id, project_ids)):
        raise PermissionDenied
    return context


def actor_can_investigate(
    *, organization: Organization, actor: ActorId | None, project_ids: Iterable[int]
) -> bool:
    """Whether an investigation's creator could still create it with these projects."""
    if actor is None or actor.id is None:
        return False
    if actor.type == ActorType.USER:
        return user_can_investigate(organization, user_service.get_user(user_id=actor.id))
    try:
        resolve_investigation_service_account(
            organization=organization, account_id=actor.id, project_ids=project_ids
        )
    except (PermissionDenied, NotebookValidationError):
        return False
    return True

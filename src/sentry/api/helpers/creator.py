from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from rest_framework.request import Request

from sentry.auth.principal import acting_user_id
from sentry.models.orgauthtoken import get_org_auth_token_id_from_auth, is_org_auth_token_auth
from sentry.service_accounts.auth import is_service_account_auth


@dataclass(frozen=True)
class ActorReference:
    """Who made a request. At most one field is set; none is set for an anonymous request."""

    user_id: int | None = None
    service_account_id: int | None = None
    org_auth_token_id: int | None = None


class CreatorReference(TypedDict):
    created_by_id: int | None
    created_by_service_account_id: int | None
    created_by_org_auth_token_id: int | None


def get_actor_reference(request: Request) -> ActorReference:
    """
    Who made this request: a user, a service account or an org auth token.

    The credential in `request.auth` is checked before `request.user`, because
    service account and org auth token requests can also carry a user.
    """
    # Some callers (e.g. validators built in tests) pass a plain Django request without `.auth`.
    auth = getattr(request, "auth", None)
    if is_service_account_auth(auth):
        return ActorReference(service_account_id=auth.entity_id)
    if is_org_auth_token_auth(auth):
        return ActorReference(org_auth_token_id=get_org_auth_token_id_from_auth(auth))
    return ActorReference(user_id=acting_user_id(request.user))


def get_creator_reference(request: Request) -> CreatorReference:
    """Creator columns for a resource created by this request. At most one is set."""
    actor = get_actor_reference(request)
    return {
        "created_by_id": actor.user_id,
        "created_by_service_account_id": actor.service_account_id,
        "created_by_org_auth_token_id": actor.org_auth_token_id,
    }

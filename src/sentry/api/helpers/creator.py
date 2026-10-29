from __future__ import annotations

from typing import TypedDict

from rest_framework.request import Request

from sentry.models.orgauthtoken import get_org_auth_token_id_from_auth, is_org_auth_token_auth
from sentry.service_accounts.auth import is_service_account_auth


class CreatorReference(TypedDict):
    created_by_id: int | None
    created_by_service_account_id: int | None
    created_by_org_auth_token_id: int | None


def get_creator_reference(request: Request) -> CreatorReference:
    """
    Creator columns for a resource created by this request. At most one is set.

    Service accounts and org auth tokens authenticate as an anonymous user, so
    `request.user.id` alone can't attribute what they create.
    """
    reference: CreatorReference = {
        "created_by_id": None,
        "created_by_service_account_id": None,
        "created_by_org_auth_token_id": None,
    }
    if request.user.is_authenticated:
        reference["created_by_id"] = request.user.id
    elif is_service_account_auth(request.auth):
        reference["created_by_service_account_id"] = request.auth.entity_id
    elif is_org_auth_token_auth(request.auth):
        reference["created_by_org_auth_token_id"] = get_org_auth_token_id_from_auth(request.auth)
    return reference

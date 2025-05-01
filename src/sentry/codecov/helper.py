from dataclasses import dataclass
from typing import Any

from sentry.auth.services.access.service import access_service
from sentry.auth.services.auth import RpcAuthIdentity
from sentry.identity.services.identity import identity_service
from sentry.identity.services.identity.model import RpcIdentity


@dataclass
class CodecovUser:
    external_id: str
    auth_token: Any


def resolve_codecov_user(user_id: int, organization_id: int) -> CodecovUser | None:
    """Given a Sentry User, and an organization id, find the GitHub user ID and GH access_token
    that is linked to Codecov's user.

    The user resolution will "fall-through" based on whether the Organization has a GitHub Auth Provider enabled.
    """
    # Get identity from an AuthProvider if it's available.
    auth_provider = access_service.get_auth_provider(organization_id)
    if auth_provider and auth_provider.provider == "github":
        auth_identity: RpcAuthIdentity | None = access_service.get_auth_identity_for_user(
            auth_provider.id, user_id
        )
        if auth_identity:
            return CodecovUser(
                external_id=str(auth_identity.ident),
                auth_token=auth_identity.data.get("access_token"),
            )

    # Get identity from Identity if it's available.
    identities: list[RpcIdentity] = identity_service.get_user_identities_by_provider_type(
        user_id=user_id, provider_type="github"
    )
    if identities:
        # Note: There is currently either zero or one GitHub "identity" mapped to a user.
        identity = identities[0]
        return CodecovUser(
            external_id=identity.external_id,
            auth_token=identity.data.get("access_token"),
        )

    # No GitHub identities tied to user, return None
    return None

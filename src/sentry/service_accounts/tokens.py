from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sentry.types.token import AuthTokenType
from sentry.utils.security import orgauthtoken_token

SERVICE_ACCOUNT_TOKEN_PREFIX = AuthTokenType.SERVICE_ACCOUNT


@dataclass(frozen=True)
class StoredTokenFields:
    """The parts of a service account token that are safe to persist."""

    token_hashed: str = field(repr=False)
    token_last_characters: str


def generate_token(org_slug: str, region_url: str) -> str:
    """
    Return a new plaintext token. Show it to the admin once and persist only
    `stored_token_fields(token)`.

    Uses the org auth token layout, so GitHub secret scanning and our parser can read the
    organization and region without a lookup.
    """
    return orgauthtoken_token.generate_token(
        org_slug, region_url, prefix=SERVICE_ACCOUNT_TOKEN_PREFIX
    )


def parse_token(token: str) -> dict[str, Any] | None:
    return orgauthtoken_token.parse_token(token, prefix=SERVICE_ACCOUNT_TOKEN_PREFIX)


def stored_token_fields(token: str) -> StoredTokenFields:
    return StoredTokenFields(
        token_hashed=orgauthtoken_token.hash_token(token), token_last_characters=token[-4:]
    )

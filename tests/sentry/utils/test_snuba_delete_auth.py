from __future__ import annotations

import jwt
import pytest
from django.test import override_settings

from sentry.utils.snuba_delete_auth import (
    SNUBA_DELETE_AUDIENCE,
    SNUBA_DELETE_PRINCIPAL,
    mint_snuba_delete_token,
    snuba_delete_auth_headers,
)


@override_settings(SENTRY_SNUBA_DELETE_AUTH_SECRET="sentry-test-snuba-delete-secret")
def test_mint_token_contains_authorized_ids() -> None:
    token = mint_snuba_delete_token(project_ids=[11], organization_ids=[22])
    payload = jwt.decode(
        token,
        "sentry-test-snuba-delete-secret",
        algorithms=["HS256"],
        audience=SNUBA_DELETE_AUDIENCE,
    )
    assert payload["sub"] == SNUBA_DELETE_PRINCIPAL
    assert payload["iss"] == "sentry"
    assert payload["project_ids"] == [11]
    assert payload["organization_ids"] == [22]
    assert payload["exp"] - payload["iat"] <= 60


@override_settings(SENTRY_SNUBA_DELETE_AUTH_SECRET="sentry-test-snuba-delete-secret")
def test_auth_headers_are_bearer() -> None:
    headers = snuba_delete_auth_headers(project_ids=[1], organization_ids=[2])
    assert set(headers) == {"Authorization"}
    assert headers["Authorization"].startswith("Bearer ")


@override_settings(SENTRY_SNUBA_DELETE_AUTH_SECRET="")
def test_missing_secret_omits_headers() -> None:
    assert snuba_delete_auth_headers(project_ids=[1], organization_ids=[2]) == {}


@override_settings(SENTRY_SNUBA_DELETE_AUTH_SECRET="")
def test_missing_secret_mint_fails_closed() -> None:
    with pytest.raises(RuntimeError, match="SENTRY_SNUBA_DELETE_AUTH_SECRET"):
        mint_snuba_delete_token(project_ids=[1], organization_ids=[2])

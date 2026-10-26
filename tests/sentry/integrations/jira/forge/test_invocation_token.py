from __future__ import annotations

import time
from typing import Any
from unittest.mock import MagicMock, patch

import orjson
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from jwt.algorithms import RSAAlgorithm

from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocation,
    ForgeInvocationTokenError,
    verify_forge_invocation_token,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils import jwt

APP_ID = "ari:cloud:ecosystem::app/00000000-0000-0000-0000-000000000001"
OTHER_APP_ID = "ari:cloud:ecosystem::app/00000000-0000-0000-0000-000000000002"
KID = "forge/invocation-token/test-key"

SIGNING_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _jwks_response() -> MagicMock:
    jwk = orjson.loads(RSAAlgorithm.to_jwk(SIGNING_KEY.public_key()))
    response = MagicMock()
    response.json.return_value = {"keys": [{**jwk, "kid": KID, "alg": "RS256", "use": "sig"}]}
    return response


def _claims(**overrides: Any) -> dict[str, Any]:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": "forge/invocation-token",
        "aud": APP_ID,
        "iat": now,
        "nbf": now,
        "exp": now + 25,
        "app": {
            "id": APP_ID,
            "installationId": "ari:cloud:ecosystem::installation/abc",
            "apiBaseUrl": "https://api.atlassian.com/ex/jira/cloud-123",
            "environment": {"type": "DEVELOPMENT"},
            "module": {"key": "issue-updated-endpoint", "type": "core:endpoint"},
        },
        "context": {"cloudId": "cloud-123"},
    }
    claims.update(overrides)
    return claims


def _token(claims: dict[str, Any], key: rsa.RSAPrivateKey = SIGNING_KEY, kid: str = KID) -> str:
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": kid})


class VerifyForgeInvocationTokenTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.enterContext(override_options({"jira.forge.app-ids": [APP_ID]}))
        self.mock_urlopen = self.enterContext(
            patch(
                "sentry.integrations.jira.forge.invocation_token.safe_urlopen",
                side_effect=lambda *args, **kwargs: _jwks_response(),
            )
        )

    def test_valid_token(self) -> None:
        assert verify_forge_invocation_token(_token(_claims())) == ForgeInvocation(
            app_id=APP_ID,
            installation_id="ari:cloud:ecosystem::installation/abc",
            api_base_url="https://api.atlassian.com/ex/jira/cloud-123",
            cloud_id="cloud-123",
            environment_type="DEVELOPMENT",
            module_key="issue-updated-endpoint",
            principal=None,
        )

        # The key set is cached between requests.
        verify_forge_invocation_token(_token(_claims()))
        assert self.mock_urlopen.call_count == 1

    def test_rejects_invalid_tokens(self) -> None:
        now = int(time.time())
        app = _claims()["app"]
        invalid = {
            "untrusted app": _token(_claims(aud=OTHER_APP_ID, app={**app, "id": OTHER_APP_ID})),
            "app id differs from audience": _token(_claims(app={**app, "id": OTHER_APP_ID})),
            "expired": _token(_claims(iat=now - 60, nbf=now - 60, exp=now - 30)),
            "wrong issuer": _token(_claims(iss="someone-else")),
            "signed by another key": _token(_claims(), key=OTHER_KEY),
            "unknown key id": _token(_claims(), kid="forge/invocation-token/unknown"),
            "isolated cloud": _token(_claims(icLabel="orange")),
            "missing installation": _token(_claims(app={**app, "installationId": None})),
            "not a jwt": "not-a-jwt",
        }
        for reason, token in invalid.items():
            with pytest.raises(ForgeInvocationTokenError):
                verify_forge_invocation_token(token)
                pytest.fail(f"accepted a token with {reason}")

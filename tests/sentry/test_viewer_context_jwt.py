from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from django.test import override_settings

from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    decode_viewer_context,
    encode_viewer_context,
    is_jwt_viewer_context,
)


class TestEncodeDecodeRoundtrip(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_roundtrip(self):
        vc = ViewerContext(organization_id=42, user_id=7, actor_type=ActorType.USER)
        token = encode_viewer_context(vc)
        result = decode_viewer_context(token)

        assert result.organization_id == 42
        assert result.user_id == 7
        assert result.actor_type == ActorType.USER
        assert result.token is None

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_roundtrip_minimal(self):
        vc = ViewerContext(actor_type=ActorType.SYSTEM)
        token = encode_viewer_context(vc)
        result = decode_viewer_context(token)

        assert result.organization_id is None
        assert result.user_id is None
        assert result.actor_type == ActorType.SYSTEM

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_roundtrip_integration(self):
        vc = ViewerContext(organization_id=99, actor_type=ActorType.INTEGRATION)
        token = encode_viewer_context(vc)
        result = decode_viewer_context(token)

        assert result.organization_id == 99
        assert result.actor_type == ActorType.INTEGRATION


class TestEncodeViewerContext(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_standard_claims_present(self):
        vc = ViewerContext(organization_id=1, actor_type=ActorType.USER)
        token = encode_viewer_context(vc)

        claims = pyjwt.decode(token, options={"verify_signature": False})
        assert "iat" in claims
        assert "exp" in claims
        assert claims["iss"] == "sentry"
        assert claims["exp"] - claims["iat"] == 900  # default TTL

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_custom_ttl(self):
        vc = ViewerContext(organization_id=1, actor_type=ActorType.USER)
        token = encode_viewer_context(vc, ttl=300)

        claims = pyjwt.decode(token, options={"verify_signature": False})
        assert claims["exp"] - claims["iat"] == 300

    def test_custom_key_parameter(self):
        vc = ViewerContext(organization_id=1, actor_type=ActorType.USER)
        token = encode_viewer_context(vc, key="my-custom-key")
        result = decode_viewer_context(token, key="my-custom-key")

        assert result.organization_id == 1

    @override_settings(SEER_API_SHARED_SECRET="")
    def test_no_key_raises_value_error(self):
        vc = ViewerContext(organization_id=1, actor_type=ActorType.USER)
        with pytest.raises(ValueError, match="No signing key available"):
            encode_viewer_context(vc)

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_token_field_not_in_jwt(self):
        from unittest.mock import MagicMock

        mock_token = MagicMock()
        mock_token.kind = "api_token"
        mock_token.get_scopes.return_value = ["org:read"]

        vc = ViewerContext(organization_id=1, actor_type=ActorType.USER, token=mock_token)
        jwt_token = encode_viewer_context(vc)

        result = decode_viewer_context(jwt_token)
        assert result.token is None

        claims = pyjwt.decode(jwt_token, options={"verify_signature": False})
        assert "token" not in claims


class TestDecodeViewerContext(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_expired_token_rejected(self):
        payload = {
            "organization_id": 1,
            "actor_type": "user",
            "iat": time.time() - 120,
            "exp": time.time() - 60,
            "iss": "sentry",
        }
        from sentry.viewer_context import _key_id

        expired_token = pyjwt.encode(
            payload,
            "test-secret-key",
            algorithm="HS256",
            headers={"kid": _key_id("test-secret-key")},
        )

        with pytest.raises(pyjwt.exceptions.ExpiredSignatureError):
            decode_viewer_context(expired_token)

    def test_wrong_key_rejected(self):
        vc = ViewerContext(organization_id=1, actor_type=ActorType.USER)
        token = encode_viewer_context(vc, key="correct-key")

        with pytest.raises(pyjwt.exceptions.InvalidSignatureError):
            decode_viewer_context(token, key="wrong-key")

    def test_leeway_accepts_nearly_expired(self):
        payload = {
            "organization_id": 1,
            "actor_type": "user",
            "iat": time.time() - 63,
            "exp": time.time() - 3,  # expired 3 seconds ago
            "iss": "sentry",
        }
        token = pyjwt.encode(payload, "test-key", algorithm="HS256")

        # Should succeed with default leeway of 5 seconds
        result = decode_viewer_context(token, key="test-key")
        assert result.organization_id == 1

    @override_settings(SEER_API_SHARED_SECRET="")
    def test_no_verification_key_raises(self):
        vc = ViewerContext(organization_id=1, actor_type=ActorType.USER)
        token = encode_viewer_context(vc, key="some-key")

        with pytest.raises(ValueError, match="No verification keys available"):
            decode_viewer_context(token)


class TestIsJwtViewerContext(TestCase):
    def test_jwt_string(self):
        assert is_jwt_viewer_context("eyJhbGciOiJIUzI1NiJ9.eyJmb28iOiJiYXIifQ.sig") is True

    def test_json_string(self):
        assert is_jwt_viewer_context('{"actor_type": "user", "organization_id": 1}') is False

    def test_empty_string(self):
        assert is_jwt_viewer_context("") is False

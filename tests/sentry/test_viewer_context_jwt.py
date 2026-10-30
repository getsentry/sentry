from __future__ import annotations

import time
from datetime import timedelta

import jwt as pyjwt
import pytest
from django.test import override_settings
from django.utils import timezone
from sentry_viewercontext import key_id

from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.viewer_context import (
    Actor,
    ActorType,
    SuperuserAccess,
    ViewerContext,
    decode_viewer_context,
    encode_viewer_context,
    is_jwt_viewer_context,
)


class TestEncodeEarlyAdopterClaim(TestCase):
    def _claims(self, vc: ViewerContext) -> dict:
        return pyjwt.decode(encode_viewer_context(vc), "test-secret-key", algorithms=["HS256"])

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_early_adopter_organization_sets_claim(self):
        organization = self.create_organization()
        organization.flags.early_adopter = True
        organization.save()

        claims = self._claims(
            ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=organization.id)
        )

        assert claims["organization_is_early_adopter"] is True

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_early_adopter_claim_in_control_silo(self):
        with outbox_runner():
            organization = self.create_organization()
            organization.flags.early_adopter = True
            organization.save()

        with assume_test_silo_mode(SiloMode.CONTROL):
            claims = self._claims(
                ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=organization.id)
            )

        assert claims["organization_is_early_adopter"] is True

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_regular_organization_omits_claim(self):
        organization = self.create_organization()

        claims = self._claims(
            ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=organization.id)
        )

        assert "organization_is_early_adopter" not in claims

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_missing_organization_omits_claim(self):
        claims = self._claims(
            ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=987654321)
        )

        assert "organization_is_early_adopter" not in claims

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_no_organization_omits_claim(self):
        claims = self._claims(ViewerContext(actor=Actor(type=ActorType.SYSTEM)))

        assert "organization_is_early_adopter" not in claims


class TestEncodeDecodeRoundtrip(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_roundtrip(self):
        vc = ViewerContext(
            organization_id=42, actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=7)
        )
        token = encode_viewer_context(vc)
        result = decode_viewer_context(token)
        assert result == vc

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_roundtrip_minimal(self):
        vc = ViewerContext(actor=Actor(type=ActorType.SYSTEM))
        token = encode_viewer_context(vc)
        result = decode_viewer_context(token)
        assert isinstance(result, ViewerContext)

        assert result.organization_id is None
        assert result.actor.actor_id is None
        assert result.actor.type == ActorType.SYSTEM

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_roundtrip_integration(self):
        vc = ViewerContext(actor=Actor(type=ActorType.INTEGRATION), organization_id=99)
        token = encode_viewer_context(vc)
        result = decode_viewer_context(token)
        assert isinstance(result, ViewerContext)

        assert result.organization_id == 99
        assert result.actor.type == ActorType.INTEGRATION


class TestEncodeViewerContext(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_superuser_jwt_lifetime_cannot_exceed_five_minutes(self):
        vc = ViewerContext(
            actor=Actor(
                type=ActorType.USER,
                actor_id=7,
                superuser=SuperuserAccess(expires_at=int(time.time()) + 600),
            ),
            organization_id=1,
        )
        claims = pyjwt.decode(encode_viewer_context(vc), options={"verify_signature": False})
        assert claims["exp"] - claims["iat"] == 300

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_superuser_deadline_is_not_renewed_when_reencoded(self):
        deadline = int(time.time()) + 300
        vc = ViewerContext(
            actor=Actor(
                type=ActorType.USER, actor_id=7, superuser=SuperuserAccess(expires_at=deadline)
            ),
            organization_id=1,
        )
        token = encode_viewer_context(vc)
        with freeze_time(timezone.now() + timedelta(minutes=4)):
            propagated = encode_viewer_context(decode_viewer_context(token))
        claims = pyjwt.decode(propagated, options={"verify_signature": False})
        assert claims["actor"]["superuser"] == {"expires_at": deadline}
        assert claims["exp"] == deadline

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_standard_claims_present(self):
        vc = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
        token = encode_viewer_context(vc)

        claims = pyjwt.decode(token, options={"verify_signature": False})
        assert "iat" in claims
        assert "exp" in claims
        assert claims["iss"] == "sentry"
        assert claims["exp"] - claims["iat"] == 900  # default TTL

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_custom_ttl(self):
        vc = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
        token = encode_viewer_context(vc, ttl=300)

        claims = pyjwt.decode(token, options={"verify_signature": False})
        assert claims["exp"] - claims["iat"] == 300

    def test_custom_key_parameter(self):
        vc = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
        token = encode_viewer_context(vc, key="my-custom-key")
        result = decode_viewer_context(token, key="my-custom-key")

        assert result.organization_id == 1

    @override_settings(SEER_API_SHARED_SECRET="")
    def test_no_key_raises_value_error(self):
        vc = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
        with pytest.raises(ValueError, match="No signing key available"):
            encode_viewer_context(vc)

    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_token_field_not_in_jwt(self):
        vc = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
        jwt_token = encode_viewer_context(vc)

        result = decode_viewer_context(jwt_token)
        assert isinstance(result, ViewerContext)

        claims = pyjwt.decode(jwt_token, options={"verify_signature": False})
        assert "token" not in claims


class TestDecodeViewerContext(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="test-secret-key")
    def test_expired_token_rejected(self):
        payload = {
            "organization_id": 1,
            "version": 2,
            "actor": {"type": "user", "id": 7},
            "iat": time.time() - 120,
            "exp": time.time() - 60,
            "iss": "sentry",
        }

        expired_token = pyjwt.encode(
            payload,
            "test-secret-key",
            algorithm="HS256",
            headers={"kid": key_id("test-secret-key")},
        )

        with pytest.raises(pyjwt.exceptions.ExpiredSignatureError):
            decode_viewer_context(expired_token)

    def test_wrong_key_rejected(self):
        vc = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
        token = encode_viewer_context(vc, key="correct-key")

        with pytest.raises(pyjwt.exceptions.InvalidTokenError, match="No verification key"):
            decode_viewer_context(token, key="wrong-key")

    def test_leeway_accepts_nearly_expired(self):
        payload = {
            "organization_id": 1,
            "version": 2,
            "actor": {"type": "user", "id": 7},
            "iat": time.time() - 63,
            "exp": time.time() - 3,  # expired 3 seconds ago
            "iss": "sentry",
        }
        token = pyjwt.encode(
            payload, "test-key", algorithm="HS256", headers={"kid": key_id("test-key")}
        )

        # Should succeed with default leeway of 5 seconds
        result = decode_viewer_context(token, key="test-key")
        assert result.organization_id == 1

    @override_settings(SEER_API_SHARED_SECRET="")
    def test_no_verification_key_raises(self):
        vc = ViewerContext(actor=Actor(type=ActorType.UNKNOWN), organization_id=1)
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

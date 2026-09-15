from __future__ import annotations

import time
from typing import Any
from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_ISSUER,
    CURSOR_ORIGIN_RECEIPT_TYP,
)
from sentry.integrations.cursor_origin.keys import OriginSigningKey
from sentry.integrations.cursor_origin.pipeline import (
    CursorOriginInstallApiStep,
    verify_receipt,
)
from sentry.pipeline.types import PipelineStepAction, PipelineStepResult
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

APP_ID = "app_01example"
INSTALLATION_ID = "i_01example"
STATE = "anti-forgery-value"
KID = "origin-key-1"
KEYS = "sentry.integrations.cursor_origin.pipeline.signing_keys_for"


def _signing_key() -> tuple[Ed25519PrivateKey, OriginSigningKey]:
    private = Ed25519PrivateKey.generate()
    from cryptography.hazmat.primitives import serialization

    raw = private.public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw
    )
    return private, OriginSigningKey(kid=KID, public_key=raw)


def _receipt(
    private: Ed25519PrivateKey,
    *,
    typ: str = CURSOR_ORIGIN_RECEIPT_TYP,
    kid: str = KID,
    issuer: str = CURSOR_ORIGIN_ISSUER,
    audience: str = APP_ID,
    subject: str | None = INSTALLATION_ID,
    state: str | None = STATE,
    expires_in: int = 300,
) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": issuer,
        "aud": audience,
        "iat": now,
        "exp": now + expires_in,
        "jti": "receipt-uuid",
    }
    if subject is not None:
        claims["sub"] = subject
    if state is not None:
        claims["state"] = state
    return jwt.encode(claims, private, algorithm="EdDSA", headers={"kid": kid, "typ": typ})


@control_silo_test
class VerifyReceiptTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.private, self.public = _signing_key()

    def _verify(
        self, receipt: str, state: str = STATE, keys: list[OriginSigningKey] | None = None
    ) -> str | None:
        with (
            self.options({"cursor-origin-app.id": APP_ID}),
            mock.patch(KEYS, return_value=self.public_keys(keys)) as self.mock_keys,
        ):
            return verify_receipt(receipt, state)

    def public_keys(self, keys: list[OriginSigningKey] | None) -> list[OriginSigningKey]:
        return [self.public] if keys is None else keys

    def test_a_valid_receipt_yields_the_installation_id(self) -> None:
        assert self._verify(_receipt(self.private)) == INSTALLATION_ID

    def test_the_key_is_resolved_by_kid(self) -> None:
        self._verify(_receipt(self.private))

        assert self.mock_keys.call_args.args == (KID,)

    def test_an_unsigned_receipt_is_refused(self) -> None:
        forged = jwt.encode({"sub": "i_someone_elses", "state": STATE}, "secret", algorithm="HS256")

        assert self._verify(forged) is None

    def test_a_receipt_signed_by_an_unknown_key_is_refused(self) -> None:
        other, _ = _signing_key()

        assert self._verify(_receipt(other)) is None

    def test_no_keys_means_refused_not_trusted(self) -> None:
        assert self._verify(_receipt(self.private), keys=[]) is None

    def test_the_wrong_typ_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, typ="JWT")) is None

    def test_another_issuer_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, issuer="https://evil.test")) is None

    def test_a_receipt_for_another_app_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, audience="app_someone_else")) is None

    def test_an_expired_receipt_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, expires_in=-60)) is None

    def test_a_mismatched_state_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, state="someone-elses")) is None

    def test_a_missing_state_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, state=None)) is None

    def test_a_receipt_with_an_empty_subject_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, subject="")) is None

    def test_an_unreadable_receipt_is_refused(self) -> None:
        assert self._verify("not-a-jwt") is None


@control_silo_test
class InstallStepTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.private, self.public = _signing_key()
        self.pipeline = mock.Mock(signature=STATE)

    def _post(self, **data: str) -> PipelineStepResult:
        with (
            self.options({"cursor-origin-app.id": APP_ID}),
            mock.patch(KEYS, return_value=[self.public]),
        ):
            return CursorOriginInstallApiStep().handle_post(
                {"state": STATE, **data}, self.pipeline, mock.Mock()
            )

    def test_a_verified_receipt_binds_the_installation(self) -> None:
        result = self._post(installation_receipt=_receipt(self.private))

        assert result.action == PipelineStepAction.ADVANCE
        assert self.pipeline.bind_state.call_args.args == ("installation_id", INSTALLATION_ID)

    def test_a_replayed_state_is_refused(self) -> None:
        result = CursorOriginInstallApiStep().handle_post(
            {"state": "someone-elses", "installation_receipt": "x"}, self.pipeline, mock.Mock()
        )
        assert result.action == PipelineStepAction.ERROR
        assert not self.pipeline.bind_state.called

    def test_an_unverifiable_receipt_is_refused(self) -> None:
        other, _ = _signing_key()
        result = self._post(installation_receipt=_receipt(other))
        assert result.action == PipelineStepAction.ERROR
        assert not self.pipeline.bind_state.called

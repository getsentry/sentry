from __future__ import annotations

import time
from typing import Any
from unittest import mock
from urllib.parse import urlencode

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from django.http.response import HttpResponseBase
from django.urls import reverse
from rest_framework.exceptions import ValidationError

from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_ISSUER,
    CURSOR_ORIGIN_RECEIPT_TYP,
)
from sentry.integrations.cursor_origin.integration import CursorOriginIntegrationProvider
from sentry.integrations.cursor_origin.keys import OriginSigningKey
from sentry.integrations.cursor_origin.pipeline import (
    CursorOriginInstallApiStep,
    ExternalInstallSerializer,
    verify_receipt,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.types import PipelineStepAction, PipelineStepResult
from sentry.testutils.cases import IntegrationTestCase, TestCase
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
    issued_in: int = 0,
) -> str:
    now = int(time.time()) + issued_in
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
        self, receipt: str, state: str | None = STATE, keys: list[OriginSigningKey] | None = None
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

    def test_a_receipt_issued_slightly_ahead_still_verifies(self) -> None:
        assert self._verify(_receipt(self.private, issued_in=20)) == INSTALLATION_ID

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

    def test_a_state_less_receipt_verifies_when_no_state_is_expected(self) -> None:
        receipt = _receipt(self.private, state=None)

        assert self._verify(receipt, state=None) == INSTALLATION_ID

    def test_a_receipt_carrying_a_state_is_refused_when_none_is_expected(self) -> None:
        assert self._verify(_receipt(self.private), state=None) is None

    def test_a_state_less_receipt_signed_by_an_unknown_key_is_refused(self) -> None:
        other, _ = _signing_key()

        assert self._verify(_receipt(other, state=None), state=None) is None

    def test_a_state_less_receipt_is_refused_when_no_key_is_published(self) -> None:
        receipt = _receipt(self.private, state=None)

        assert self._verify(receipt, state=None, keys=[]) is None

    def test_a_state_less_receipt_with_the_wrong_typ_is_refused(self) -> None:
        assert self._verify(_receipt(self.private, state=None, typ="JWT"), state=None) is None

    def test_a_state_less_receipt_from_another_issuer_is_refused(self) -> None:
        receipt = _receipt(self.private, state=None, issuer="https://evil.test")

        assert self._verify(receipt, state=None) is None

    def test_a_state_less_receipt_for_another_app_is_refused(self) -> None:
        receipt = _receipt(self.private, state=None, audience="app_someone_else")

        assert self._verify(receipt, state=None) is None

    def test_an_expired_state_less_receipt_is_refused(self) -> None:
        receipt = _receipt(self.private, state=None, expires_in=-60)

        assert self._verify(receipt, state=None) is None

    def test_a_state_less_receipt_with_an_empty_subject_is_refused(self) -> None:
        receipt = _receipt(self.private, state=None, subject="")

        assert self._verify(receipt, state=None) is None


@control_silo_test
class InstallStepTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.private, self.public = _signing_key()
        self.pipeline = mock.Mock(signature=STATE)
        # Nothing bound yet: the install started inside Sentry.
        self.pipeline.fetch_state.return_value = None

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

    def test_an_origin_initiated_install_finishes_without_another_receipt(self) -> None:
        """ExternalInstallSerializer already verified the receipt and bound the install."""
        self.pipeline.fetch_state.return_value = INSTALLATION_ID

        result = CursorOriginInstallApiStep().handle_post(
            {"state": STATE}, self.pipeline, mock.Mock()
        )

        assert result.action == PipelineStepAction.ADVANCE

    def test_the_step_reports_an_install_origin_already_ran(self) -> None:
        self.pipeline.fetch_state.return_value = INSTALLATION_ID

        with self.options({"cursor-origin-app.id": APP_ID}):
            step_data = CursorOriginInstallApiStep().get_step_data(self.pipeline, mock.Mock())

        assert step_data["originInitiated"] is True
        assert step_data["state"] == STATE

    def test_a_missing_receipt_is_refused_when_nothing_is_bound(self) -> None:
        result = CursorOriginInstallApiStep().handle_post(
            {"state": STATE}, self.pipeline, mock.Mock()
        )

        assert result.action == PipelineStepAction.ERROR

    def test_an_unverifiable_receipt_is_refused(self) -> None:
        other, _ = _signing_key()
        result = self._post(installation_receipt=_receipt(other))
        assert result.action == PipelineStepAction.ERROR
        assert not self.pipeline.bind_state.called


@control_silo_test
class PipelineAdvancerTest(IntegrationTestCase):
    """The setup redirect for an install started from Origin's marketplace."""

    provider = CursorOriginIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.private, self.public = _signing_key()
        # An Origin-initiated install has no pipeline in the session.
        self.session.clear()
        self.save_session()

    def _setup(self, **params: str) -> HttpResponseBase:
        with (
            self.options({"cursor-origin-app.id": APP_ID}),
            mock.patch(KEYS, return_value=[self.public]),
        ):
            return self.client.get(f"{self.setup_path}?{urlencode(params)}")

    def _org_picker(self, receipt: str) -> str:
        return reverse(
            "sentry-integration-installation-link",
            kwargs={"integration_slug": IntegrationProviderSlug.CURSOR_ORIGIN.value},
            query={"installationReceipt": receipt},
        )

    def test_an_origin_initiated_install_lands_on_the_org_picker(self) -> None:
        """The receipt travels on, so the pipeline verifies it rather than trusting an id."""
        receipt = _receipt(self.private, state=None)

        resp = self._setup(installation_receipt=receipt)

        assert resp.status_code == 302
        assert resp["Location"] == self._org_picker(receipt)

    def test_a_receipt_signed_by_an_unknown_key_is_refused(self) -> None:
        other, _ = _signing_key()

        resp = self._setup(installation_receipt=_receipt(other, state=None))

        assert resp.status_code == 302
        assert resp["Location"] == "/"

    def test_a_receipt_from_the_in_sentry_flow_is_refused(self) -> None:
        resp = self._setup(installation_receipt=_receipt(self.private))

        assert resp.status_code == 302
        assert resp["Location"] == "/"

    def test_an_unreadable_receipt_is_refused(self) -> None:
        resp = self._setup(installation_receipt="not-a-jwt")

        assert resp.status_code == 302
        assert resp["Location"] == "/"

    def test_an_installation_id_without_a_receipt_is_not_trusted(self) -> None:
        resp = self._setup(setup_action="install", installation_id="i_someone_elses")

        assert resp.status_code == 302
        assert resp["Location"] == "/"


@control_silo_test
class ExternalInstallSerializerTest(TestCase):
    """What the org picker hands back to the pipeline as initial data."""

    def setUp(self) -> None:
        super().setUp()
        self.private, self.public = _signing_key()

    def _validated(self, data: dict[str, str]) -> dict[str, str]:
        with (
            self.options({"cursor-origin-app.id": APP_ID}),
            mock.patch(KEYS, return_value=[self.public]),
        ):
            serializer = ExternalInstallSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            return serializer.validated_data

    def test_binds_only_the_installation_the_receipt_names(self) -> None:
        receipt = _receipt(self.private, state=None)

        assert self._validated({"installationReceipt": receipt}) == {
            "installation_id": INSTALLATION_ID
        }

    def test_an_install_started_in_sentry_carries_nothing(self) -> None:
        assert self._validated({}) == {}

    def test_a_forged_receipt_is_refused(self) -> None:
        """The receipt reaches us through the browser, so it is verified here."""
        other, _ = _signing_key()

        with pytest.raises(ValidationError):
            self._validated({"installationReceipt": _receipt(other, state=None)})

    def test_a_receipt_from_the_in_sentry_flow_is_refused(self) -> None:
        with pytest.raises(ValidationError):
            self._validated({"installationReceipt": _receipt(self.private)})

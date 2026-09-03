from __future__ import annotations

from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from sentry.integrations.cursor_origin.pipeline import _installation_id_from_receipt
from sentry.testutils.cases import TestCase

FETCH_KEYS = "sentry.integrations.cursor_origin.pipeline.fetch_public_keys"


def _public_bytes(private_key: Ed25519PrivateKey) -> bytes:
    """The raw public key, in the form the JWKS `x` parameter decodes to."""
    return private_key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)


def _receipt(private_key: Ed25519PrivateKey, subject: str = "in_real") -> str:
    return jwt.encode({"sub": subject}, private_key, algorithm="EdDSA")


class InstallReceiptVerificationTest(TestCase):
    """The receipt signature is the only thing binding an installation to its installer.

    Trusting `sub` unverified let a caller attach another organization's codebase
    to their own (Warden E8X-WUV / 9RT-3JX), so what matters most here is what gets
    *rejected*, not that the happy path works.
    """

    def setUp(self) -> None:
        super().setUp()
        self.origin_key = Ed25519PrivateKey.generate()

    def test_accepts_a_receipt_signed_by_an_origin_key(self) -> None:
        with mock.patch(FETCH_KEYS, return_value=[_public_bytes(self.origin_key)]):
            assert _installation_id_from_receipt(_receipt(self.origin_key)) == "in_real"

    def test_tries_every_published_key(self) -> None:
        # Receipts carry no key id we can rely on, so one signed by any active key
        # has to verify -- not only one signed by the first key published.
        keys = [_public_bytes(Ed25519PrivateKey.generate()), _public_bytes(self.origin_key)]
        with mock.patch(FETCH_KEYS, return_value=keys):
            assert _installation_id_from_receipt(_receipt(self.origin_key)) == "in_real"

    def test_rejects_a_receipt_signed_by_an_unknown_key(self) -> None:
        # The actual attack: a well-formed receipt naming someone else's
        # installation, signed by a key Origin never published.
        forged = _receipt(Ed25519PrivateKey.generate(), subject="in_victim")
        with mock.patch(FETCH_KEYS, return_value=[_public_bytes(self.origin_key)]):
            assert _installation_id_from_receipt(forged) is None

    def test_rejects_an_unsigned_receipt(self) -> None:
        # Exactly what the previous verify_signature=False decode accepted.
        # key=None is how PyJWT expresses the "none" algorithm; the signature is
        # the point of the test, so the type complaint is not interesting here.
        unsigned = jwt.encode({"sub": "in_victim"}, key=None, algorithm="none")  # type: ignore[arg-type]
        with mock.patch(FETCH_KEYS, return_value=[_public_bytes(self.origin_key)]):
            assert _installation_id_from_receipt(unsigned) is None

    def test_rejects_a_malformed_receipt(self) -> None:
        with mock.patch(FETCH_KEYS, return_value=[_public_bytes(self.origin_key)]):
            assert _installation_id_from_receipt("not-a-jwt") is None

    def test_fails_closed_when_no_keys_are_available(self) -> None:
        # A JWKS outage must refuse the install rather than fall back to trusting
        # the claim.
        with mock.patch(FETCH_KEYS, return_value=[]) as fetch:
            assert _installation_id_from_receipt(_receipt(self.origin_key)) is None
        assert fetch.called

    def test_rejects_a_verified_receipt_with_no_subject(self) -> None:
        no_subject = jwt.encode({"iss": "origin"}, self.origin_key, algorithm="EdDSA")
        with mock.patch(FETCH_KEYS, return_value=[_public_bytes(self.origin_key)]):
            assert _installation_id_from_receipt(no_subject) is None

from __future__ import annotations

import base64
import hashlib
import time
from unittest.mock import patch

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sentry.integrations.cursor_origin.webhook_signature import (
    is_timestamp_fresh,
    verify_signature,
)
from sentry.testutils.cases import TestCase

WEBHOOK_ID = "whd_01example"
BODY = b'{"event":{"type":"repository.pushed"}}'


def sign(key: Ed25519PrivateKey, webhook_id: str, timestamp: str, body: bytes) -> str:
    digest = hashlib.sha256(b".".join([webhook_id.encode(), timestamp.encode(), body])).hexdigest()
    return "v1ed," + base64.b64encode(key.sign(digest.encode())).decode()


class TimestampFreshnessTest(TestCase):
    def test_accepts_recent(self) -> None:
        assert is_timestamp_fresh(str(int(time.time())))

    def test_rejects_old(self) -> None:
        assert not is_timestamp_fresh(str(int(time.time()) - 600))

    def test_rejects_far_future(self) -> None:
        # A clock-skewed sender is one thing; an hour ahead is a replay vector.
        assert not is_timestamp_fresh(str(int(time.time()) + 3600))

    def test_rejects_garbage(self) -> None:
        assert not is_timestamp_fresh("not-a-timestamp")
        assert not is_timestamp_fresh("")


class VerifySignatureTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.key = Ed25519PrivateKey.generate()
        self.public_bytes = self.key.public_key().public_bytes_raw()
        self.timestamp = str(int(time.time()))

    def _verify(self, signature: str, body: bytes = BODY, keys: list[bytes] | None = None) -> bool:
        with patch(
            "sentry.integrations.cursor_origin.webhook_signature.fetch_public_keys",
            return_value=[self.public_bytes] if keys is None else keys,
        ):
            return verify_signature(WEBHOOK_ID, self.timestamp, body, signature)

    def test_accepts_a_valid_signature(self) -> None:
        assert self._verify(sign(self.key, WEBHOOK_ID, self.timestamp, BODY))

    def test_rejects_when_body_is_tampered_with(self) -> None:
        signature = sign(self.key, WEBHOOK_ID, self.timestamp, BODY)
        assert not self._verify(signature, body=BODY + b" ")

    def test_rejects_a_signature_bound_to_a_different_delivery(self) -> None:
        # The id is part of the signed payload, so a replayed signature from
        # another delivery must not verify.
        other = sign(self.key, "whd_01other", self.timestamp, BODY)
        assert not self._verify(other)

    def test_rejects_a_signature_from_an_unknown_key(self) -> None:
        stranger = Ed25519PrivateKey.generate()
        assert not self._verify(sign(stranger, WEBHOOK_ID, self.timestamp, BODY))

    def test_accepts_when_one_of_several_keys_matches(self) -> None:
        # Signatures carry no key id, so every active key is tried. Rotation
        # means the right key is often not the first.
        others = [Ed25519PrivateKey.generate().public_key().public_bytes_raw() for _ in range(2)]
        assert self._verify(
            sign(self.key, WEBHOOK_ID, self.timestamp, BODY),
            keys=[*others, self.public_bytes],
        )

    def test_rejects_missing_version_prefix(self) -> None:
        raw = sign(self.key, WEBHOOK_ID, self.timestamp, BODY).removeprefix("v1ed,")
        assert not self._verify(raw)

    def test_rejects_malformed_base64(self) -> None:
        assert not self._verify("v1ed,!!!not-base64!!!")

    def test_rejects_when_no_keys_are_available(self) -> None:
        # A JWKS fetch failure must not fail open.
        assert not self._verify(sign(self.key, WEBHOOK_ID, self.timestamp, BODY), keys=[])

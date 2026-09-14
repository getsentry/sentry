from __future__ import annotations

import base64
from typing import Any
from unittest.mock import patch

from django.core.cache import cache

from sentry.integrations.cursor_origin.keys import (
    fetch_public_keys,
    signing_keys_for,
)
from sentry.testutils.cases import TestCase

KEY_A = b"\x01" * 32
KEY_B = b"\x02" * 32


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _jwk(kid: str | None, material: bytes | str, crv: str = "Ed25519") -> dict[str, Any]:
    key: dict[str, Any] = {
        "kty": "OKP",
        "crv": crv,
        "use": "sig",
        "alg": "EdDSA",
        "x": material if isinstance(material, str) else _b64url(material),
    }
    if kid is not None:
        key["kid"] = kid
    return key


class _FakeResponse:
    def __init__(self, payload: Any) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> Any:
        return self._payload


class CursorOriginKeysTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        cache.clear()

    def _urlopen(self, payload: Any):
        return patch(
            "sentry.integrations.cursor_origin.keys.safe_urlopen",
            return_value=_FakeResponse(payload),
        )

    def _urlopen_failing(self):
        return patch(
            "sentry.integrations.cursor_origin.keys.safe_urlopen",
            side_effect=Exception("origin unreachable"),
        )


class FetchPublicKeysTest(CursorOriginKeysTestCase):
    def test_decodes_keys_and_preserves_kid(self) -> None:
        with self._urlopen({"keys": [_jwk("key-1", KEY_A), _jwk("key-2", KEY_B)]}):
            keys = fetch_public_keys()

        assert [(k.kid, k.public_key) for k in keys] == [("key-1", KEY_A), ("key-2", KEY_B)]

    def test_key_without_a_kid_is_still_usable(self) -> None:
        """Webhook verification tries every key, so a kid-less key must survive."""
        with self._urlopen({"keys": [_jwk(None, KEY_A)]}):
            keys = fetch_public_keys()

        assert [(k.kid, k.public_key) for k in keys] == [(None, KEY_A)]

    def test_caches_between_calls(self) -> None:
        payload = {"keys": [_jwk("key-1", KEY_A)]}
        with self._urlopen(payload) as mock_urlopen:
            fetch_public_keys()
            fetch_public_keys()

        assert mock_urlopen.call_count == 1

    def test_force_refresh_bypasses_the_cache(self) -> None:
        payload = {"keys": [_jwk("key-1", KEY_A)]}
        with self._urlopen(payload) as mock_urlopen:
            fetch_public_keys()
            fetch_public_keys(force_refresh=True)

        assert mock_urlopen.call_count == 2


class MalformedJwksTest(CursorOriginKeysTestCase):
    """A malformed document must return nothing, never raise.

    Callers fail closed on an empty list. Raising would take the install pipeline
    down with a 500, which is a different outcome entirely.
    """

    def test_payload_not_an_object(self) -> None:
        with self._urlopen(["not", "an", "object"]):
            assert fetch_public_keys() == []

    def test_keys_not_a_list(self) -> None:
        with self._urlopen({"keys": {"key-1": "nope"}}):
            assert fetch_public_keys() == []

    def test_keys_absent(self) -> None:
        with self._urlopen({}):
            assert fetch_public_keys() == []

    def test_entry_not_an_object(self) -> None:
        with self._urlopen({"keys": ["nope", _jwk("key-1", KEY_A)]}):
            assert [k.kid for k in fetch_public_keys()] == ["key-1"]

    def test_non_ed25519_curve_is_skipped(self) -> None:
        with self._urlopen({"keys": [_jwk("p256", KEY_A, crv="P-256"), _jwk("key-1", KEY_A)]}):
            assert [k.kid for k in fetch_public_keys()] == ["key-1"]

    def test_missing_key_material_is_skipped(self) -> None:
        bad = _jwk("bad", KEY_A)
        del bad["x"]
        with self._urlopen({"keys": [bad, _jwk("key-1", KEY_A)]}):
            assert [k.kid for k in fetch_public_keys()] == ["key-1"]

    def test_undecodable_key_does_not_discard_its_siblings(self) -> None:
        """One bad key is a rotation hiccup; dropping the rest would be an outage."""
        with self._urlopen({"keys": [_jwk("bad", "!!!not base64!!!"), _jwk("key-1", KEY_A)]}):
            assert [k.kid for k in fetch_public_keys()] == ["key-1"]

    def test_wrong_length_key_is_skipped(self) -> None:
        with self._urlopen({"keys": [_jwk("short", b"\x01" * 16), _jwk("key-1", KEY_A)]}):
            assert [k.kid for k in fetch_public_keys()] == ["key-1"]

    def test_non_string_kid_is_dropped_but_key_kept(self) -> None:
        odd = _jwk("placeholder", KEY_A)
        odd["kid"] = 17
        with self._urlopen({"keys": [odd]}):
            keys = fetch_public_keys()

        assert [(k.kid, k.public_key) for k in keys] == [(None, KEY_A)]

    def test_nothing_usable_is_not_cached(self) -> None:
        """A bad document must not lock out verification for the full cache window."""
        with self._urlopen({"keys": []}) as mock_urlopen:
            assert fetch_public_keys() == []
            assert fetch_public_keys() == []

        assert mock_urlopen.call_count == 2


class StaleIfErrorTest(CursorOriginKeysTestCase):
    def test_fetch_failure_with_no_cache_returns_nothing(self) -> None:
        with self._urlopen_failing():
            assert fetch_public_keys() == []

    def test_serves_stale_keys_when_a_refresh_fails(self) -> None:
        """`/keys` advertises stale-if-error=600, and Origin rotates weekly."""
        with self._urlopen({"keys": [_jwk("key-1", KEY_A)]}):
            fetch_public_keys()

        with self._urlopen_failing():
            keys = fetch_public_keys(force_refresh=True)

        assert [(k.kid, k.public_key) for k in keys] == [("key-1", KEY_A)]


class SigningKeysForTest(CursorOriginKeysTestCase):
    def test_resolves_a_receipt_key_by_kid(self) -> None:
        with self._urlopen({"keys": [_jwk("key-1", KEY_A), _jwk("key-2", KEY_B)]}):
            keys = signing_keys_for("key-2")

        assert [(k.kid, k.public_key) for k in keys] == [("key-2", KEY_B)]

    def test_no_kid_returns_every_key(self) -> None:
        """Webhook signatures carry no key id, so each active key is a candidate."""
        with self._urlopen({"keys": [_jwk("key-1", KEY_A), _jwk("key-2", KEY_B)]}):
            keys = signing_keys_for(None)

        assert [k.kid for k in keys] == ["key-1", "key-2"]

    def test_unknown_kid_refetches_once_and_finds_a_rotated_key(self) -> None:
        with self._urlopen({"keys": [_jwk("old-key", KEY_A)]}):
            fetch_public_keys()

        with self._urlopen({"keys": [_jwk("new-key", KEY_B)]}) as mock_urlopen:
            keys = signing_keys_for("new-key")

        assert [(k.kid, k.public_key) for k in keys] == [("new-key", KEY_B)]
        assert mock_urlopen.call_count == 1

    def test_unknown_kid_after_refresh_returns_nothing(self) -> None:
        with self._urlopen({"keys": [_jwk("key-1", KEY_A)]}):
            assert signing_keys_for("who-is-this") == []

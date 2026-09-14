from __future__ import annotations

from typing import Any
from unittest import mock

from sentry.integrations.cursor_origin.keys import fetch_public_keys
from sentry.testutils.cases import TestCase

URLOPEN = "sentry.integrations.cursor_origin.keys.safe_urlopen"
VALID_X = "PxJ0hMCRAqYcW1S_6E1kPYNlbJWJq4gVPfPRSjNqNXQ"


class FakeResponse:
    def __init__(self, payload: Any) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> Any:
        return self._payload


class FetchPublicKeysTest(TestCase):
    """A malformed JWKS must yield no keys, never raise.

    Callers treat an empty list as "cannot verify" and fail closed -- refusing an
    install. Raising instead turns that into a 500 in the install pipeline, so the
    shape of an external document must never reach an exception.
    """

    def setUp(self) -> None:
        super().setUp()
        # force_refresh everywhere so the Django cache cannot mask a parse result.
        self.fetch = lambda: fetch_public_keys(force_refresh=True)

    def _with(self, payload: Any) -> list[bytes]:
        with mock.patch(URLOPEN, return_value=FakeResponse(payload)):
            return self.fetch()

    def test_reads_a_well_formed_key(self) -> None:
        keys = self._with({"keys": [{"crv": "Ed25519", "x": VALID_X, "kid": "k1"}]})
        assert len(keys) == 1
        assert isinstance(keys[0], bytes)

    def test_payload_is_not_an_object(self) -> None:
        payloads: tuple[Any, ...] = ([], "nope", 7, None)
        for payload in payloads:
            assert self._with(payload) == []

    def test_keys_is_null_or_missing(self) -> None:
        assert self._with({"keys": None}) == []
        assert self._with({}) == []

    def test_non_dict_entries_are_skipped(self) -> None:
        assert self._with({"keys": ["nope", 7, None, []]}) == []

    def test_non_string_x_is_skipped(self) -> None:
        assert self._with({"keys": [{"crv": "Ed25519", "x": 12345}]}) == []

    def test_undecodable_key_does_not_discard_the_others(self) -> None:
        # A rotation hiccup on one key must not take verification down entirely.
        keys = self._with(
            {
                "keys": [
                    {"crv": "Ed25519", "x": "!!!not-base64!!!", "kid": "bad"},
                    {"crv": "Ed25519", "x": VALID_X, "kid": "good"},
                ]
            }
        )
        assert len(keys) == 1

    def test_other_curves_are_ignored(self) -> None:
        assert self._with({"keys": [{"crv": "P-256", "x": VALID_X}]}) == []

    def test_a_fetch_failure_returns_no_keys(self) -> None:
        with mock.patch(URLOPEN, side_effect=OSError("boom")):
            assert self.fetch() == []

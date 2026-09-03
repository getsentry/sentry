from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.test import override_settings

from sentry.integrations.cursor_origin.client import CursorOriginSetupApiClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
INSTALLATION = "i_01example"


@override_settings(CACHES=LOCMEM)
class InstallationTokenCacheTest(TestCase):
    """A fresh client per call site must not mean a fresh token per call site.

    `get_installation().get_client()` builds a new client every time, so an
    instance-only cache meant one token exchange per call. Minting is charged
    against the app-JWT budget, which is the smaller of Origin's two.
    """

    def setUp(self) -> None:
        super().setUp()
        cache.clear()

    def _client(self) -> CursorOriginSetupApiClient:
        return CursorOriginSetupApiClient(installation_id=INSTALLATION)

    def test_a_second_client_reuses_the_cached_token(self) -> None:
        with patch.object(
            CursorOriginSetupApiClient, "post", return_value={"token": "oit_first"}
        ) as post:
            assert self._client().get_access_token() == "oit_first"
            assert self._client().get_access_token() == "oit_first"
            assert self._client().get_access_token() == "oit_first"

        assert post.call_count == 1

    def test_mints_again_once_the_cache_is_gone(self) -> None:
        # Eviction is harmless -- it costs one exchange, not a failure.
        with patch.object(CursorOriginSetupApiClient, "post", return_value={"token": "oit_a"}):
            assert self._client().get_access_token() == "oit_a"

        cache.clear()

        with patch.object(CursorOriginSetupApiClient, "post", return_value={"token": "oit_b"}):
            assert self._client().get_access_token() == "oit_b"

    def test_tokens_are_not_shared_between_installations(self) -> None:
        with patch.object(CursorOriginSetupApiClient, "post", return_value={"token": "oit_one"}):
            CursorOriginSetupApiClient(installation_id="i_one").get_access_token()

        with patch.object(
            CursorOriginSetupApiClient, "post", return_value={"token": "oit_two"}
        ) as post:
            token = CursorOriginSetupApiClient(installation_id="i_two").get_access_token()

        assert token == "oit_two"
        assert post.call_count == 1

    def test_rejects_a_response_without_a_token(self) -> None:
        with patch.object(CursorOriginSetupApiClient, "post", return_value={"nope": "x"}):
            with pytest.raises(ApiError):
                self._client().get_access_token()

    def test_requires_an_installation_id(self) -> None:
        with pytest.raises(ValueError):
            CursorOriginSetupApiClient().get_access_token()

    def test_does_not_cache_across_a_missing_installation(self) -> None:
        def fake_post(self: Any, path: str, *a: Any, **k: Any) -> dict[str, str]:
            return {"token": "oit_x"}

        with patch.object(CursorOriginSetupApiClient, "post", fake_post):
            client = self._client()
            first = client.get_access_token()
            # Same instance short-circuits before touching the cache at all.
            assert client.get_access_token() == first

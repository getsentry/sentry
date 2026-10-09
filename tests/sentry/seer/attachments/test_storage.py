from collections.abc import Iterator
from dataclasses import replace
from datetime import timedelta
from io import BytesIO
from typing import Any
from unittest.mock import ANY, Mock, patch

import pytest
import urllib3
from django.test import override_settings
from objectstore_client import Metadata, TimeToIdle
from objectstore_client.client import GetResponse
from objectstore_client.errors import RequestError

from sentry.objectstore import _create_client
from sentry.seer.attachments import storage
from sentry.seer.attachments.models import Attachment, AttachmentError
from sentry.testutils.helpers import override_options
from sentry.utils.cache import cache
from sentry.viewer_context import ViewerContext, viewer_context_scope

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def viewer() -> Iterator[None]:
    with viewer_context_scope(ViewerContext(organization_id=123)):
        yield


def metadata(**overrides: Any) -> Metadata:
    return Metadata(
        **{
            "content_type": "image/png",
            "compression": None,
            "expiration_policy": TimeToIdle(timedelta(days=91)),
            "time_created": None,
            "time_expires": None,
            "origin": None,
            "filename": "file.png",
            "size": 100,
            "custom": {"validation_version": "1", "kind": "image"},
            **overrides,
        }
    )


def test_bounded_client_disables_sdk_retries() -> None:
    client = _create_client(timeout=2.0)
    assert isinstance(client._pool.retries, urllib3.Retry)
    assert client._pool.retries.total == 0
    assert client._pool.retries.redirect == 0
    assert client._pool.timeout.connect_timeout == 2.0
    assert client._pool.timeout.read_timeout == 2.0


def test_no_org_context_fails_closed() -> None:
    with viewer_context_scope(ViewerContext()), pytest.raises(RuntimeError):
        storage.session()


@pytest.mark.parametrize(
    "error",
    [
        urllib3.exceptions.ReadTimeoutError(
            urllib3.HTTPConnectionPool("localhost"), "/", "timeout"
        ),
        RequestError("unavailable", 503, ""),
        RequestError("busy", 429, ""),
    ],
)
def test_transient_retry(error: Exception) -> None:
    call = Mock(side_effect=[error, "ok"])
    assert storage.storage_request(call) == "ok"
    assert call.call_count == 2


@pytest.mark.parametrize("status,attempts", [(403, 1), (503, 2)])
def test_storage_failure_stops_retrying(status: int, attempts: int) -> None:
    call = Mock(side_effect=RequestError("failed", status, ""))
    with pytest.raises(AttachmentError) as exc:
        storage.storage_request(call)
    assert exc.value.status_code == 503
    assert call.call_count == attempts


@pytest.mark.parametrize("key", ["../key", "https://host/key", "a%2fb", "", "a" * 256])
def test_invalid_keys(key: str) -> None:
    with (
        patch("sentry.seer.attachments.storage.session") as session,
        pytest.raises(AttachmentError),
    ):
        storage.head(key)
    session.assert_not_called()


@pytest.mark.parametrize(
    "overrides",
    [
        {"custom": {"kind": "image", "validation_version": "2"}},
        {"custom": {"kind": "image"}},
        {"content_type": "text/html"},
        {"compression": "zstd"},
        {"filename": None},
        {"size": None},
    ],
)
def test_unverified_metadata(overrides: dict[str, Any]) -> None:
    with pytest.raises(AttachmentError):
        storage.from_metadata(metadata(**overrides))


def test_metadata_cache_scoped_and_missing_not_cached() -> None:
    cache.clear()
    missing_key = "m" * 255
    with (
        patch(
            "sentry.seer.attachments.storage.head",
            side_effect=[storage.from_metadata(metadata()), None, None, None],
        ) as head,
        patch.object(cache, "set", wraps=cache.set) as cache_set,
    ):
        found, missing = storage.metadata_batch(["key", missing_key])
        assert found[0]["key"] == "key"
        assert missing == [missing_key]
        assert storage.metadata_batch(["key", missing_key]) == (found, missing)
        assert head.call_count == 3
        with viewer_context_scope(ViewerContext(organization_id=456)):
            assert storage.metadata_batch(["key"]) == ([], ["key"])
    assert head.call_count == 4
    cache_set.assert_any_call(ANY, found[0], timeout=300)


def test_batch_storage_failure_is_not_partial_success() -> None:
    cache.clear()
    with (
        patch(
            "sentry.seer.attachments.storage.head",
            side_effect=[None, AttachmentError("storage_unavailable", "unavailable", 503)],
        ),
        pytest.raises(AttachmentError) as exc,
    ):
        storage.metadata_batch(["missing", "failure"])
    assert exc.value.status_code == 503


@pytest.mark.parametrize("keys", [[], [str(n) for n in range(51)]])
def test_batch_limit(keys: list[str]) -> None:
    with pytest.raises(AttachmentError):
        storage.metadata_batch(keys)


def test_chat_always_uses_fresh_head() -> None:
    cache.clear()
    with patch(
        "sentry.seer.attachments.storage.head",
        side_effect=[storage.from_metadata(metadata()), None],
    ) as head:
        storage.metadata_batch(["key"])
        with pytest.raises(AttachmentError) as exc:
            storage.validate_message(["key"], "hello")
    assert exc.value.code == "attachment_missing"
    assert head.call_count == 2


@pytest.mark.parametrize(
    "keys,code",
    [(["a"] * 2, "duplicate_keys"), ([str(n) for n in range(6)], "too_many_attachments")],
)
def test_chat_key_limits(keys: list[str], code: str) -> None:
    with (
        patch("sentry.seer.attachments.storage.head") as head,
        pytest.raises(AttachmentError) as exc,
    ):
        storage.validate_message(keys, "hello")
    assert exc.value.code == code
    head.assert_not_called()


def test_chat_image_only_and_aggregate_boundary() -> None:
    attachment = replace(storage.from_metadata(metadata()), size=3 * 1024 * 1024)
    with patch("sentry.seer.attachments.storage.head", return_value=attachment):
        storage.validate_message(["a", "b", "c", "d"], "")
        with pytest.raises(AttachmentError) as exc:
            storage.validate_message(["a", "b", "c", "d", "e"], "hello")
    assert exc.value.code == "message_too_large"
    assert exc.value.status_code == 413


def test_nonimages_require_text() -> None:
    attachment = Attachment("file.md", "text/markdown", 10, "markdown")
    with patch("sentry.seer.attachments.storage.head", return_value=attachment):
        with pytest.raises(AttachmentError) as exc:
            storage.validate_message(["a"], "  ")
        storage.validate_message(["a"], "hello")
    assert exc.value.code == "query_required"


def test_current_limits_rechecked() -> None:
    with (
        patch(
            "sentry.seer.attachments.storage.head", return_value=storage.from_metadata(metadata())
        ),
        override_options({"seer.attachments.max-image-bytes": 99}),
        pytest.raises(AttachmentError) as exc,
    ):
        storage.validate_message(["key"], "hello")
    assert exc.value.status_code == 413


def test_read_closes_payload_on_error() -> None:
    payload = BytesIO(b"short")
    retry_payload = BytesIO(b"short")
    with patch("sentry.seer.attachments.storage.session") as session:
        session.return_value.get.side_effect = [
            GetResponse(metadata(size=100), payload),
            GetResponse(metadata(size=100), retry_payload),
        ]
        with pytest.raises(AttachmentError) as exc:
            storage.read("key")
    assert exc.value.status_code == 503
    assert payload.closed
    assert retry_payload.closed


def test_objectstore_existing_client_settings_preserved() -> None:
    with (
        override_settings(
            SENTRY_OBJECTSTORE_CONFIG={
                "base_url": "http://localhost:8888",
                "connection_kwargs": None,
            }
        ),
        patch("sentry.objectstore.Client") as client,
    ):
        _create_client()
    assert client.call_args.kwargs["connection_kwargs"] is None
    assert client.call_args.kwargs["retries"] is None

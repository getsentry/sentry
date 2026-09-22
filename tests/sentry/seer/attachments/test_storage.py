from dataclasses import replace
from datetime import timedelta
from io import BytesIO
from threading import Lock
from time import sleep
from unittest.mock import Mock, patch

import pytest
import urllib3
from objectstore_client import Metadata, TimeToIdle
from objectstore_client.client import GetResponse
from objectstore_client.errors import RequestError

from sentry.objectstore import UsecaseId, _create_client, get_org_session
from sentry.seer.attachments import storage
from sentry.seer.attachments.models import Attachment, AttachmentError
from sentry.testutils.helpers import override_options
from sentry.testutils.skips import requires_objectstore
from sentry.utils.cache import cache
from sentry.viewer_context import ViewerContext, viewer_context_scope

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def viewer():
    with viewer_context_scope(ViewerContext(organization_id=123)):
        yield


def metadata(**overrides):
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
            "custom": {"validation_version": "1", "kind": "image", "width": "2", "height": "3"},
            **overrides,
        }
    )


def test_session_org_scope_and_timeouts():
    with patch("sentry.seer.attachments.storage.get_org_session") as get_session:
        storage.session()
    get_session.assert_called_once_with(UsecaseId.SEER_ATTACHMENTS, 123, timeout=5.0)


def test_bounded_client_disables_sdk_retries():
    client = _create_client(timeout=2.0)
    assert client._pool.retries.total == 0
    assert client._pool.retries.redirect == 0
    assert client._pool.timeout.connect_timeout == 2.0
    assert client._pool.timeout.read_timeout == 2.0


def test_no_org_context_fails_closed():
    with viewer_context_scope(ViewerContext()), pytest.raises(RuntimeError):
        storage.session()


def test_put_original_metadata():
    attachment = Attachment("file.md", "text/markdown", 5, "markdown")
    with patch("sentry.seer.attachments.storage.session") as session:
        session.return_value.put.return_value = "key"
        assert storage.put(b"hello", attachment) == "key"
    session.return_value.put.assert_called_once_with(
        b"hello",
        compress="none",
        filename="file.md",
        content_type="text/markdown",
        metadata={"kind": "markdown", "validation_version": "1"},
    )


@pytest.mark.parametrize(
    "error",
    [
        urllib3.exceptions.ReadTimeoutError(None, "/", "timeout"),
        RequestError("unavailable", 503, ""),
        RequestError("busy", 429, ""),
    ],
)
def test_transient_retry(error):
    call = Mock(side_effect=[error, "ok"])
    assert storage.storage_request(call) == "ok"
    assert call.call_count == 2


def test_no_retry_permanent_error():
    call = Mock(side_effect=RequestError("denied", 403, ""))
    with pytest.raises(AttachmentError) as exc:
        storage.storage_request(call)
    assert exc.value.status_code == 503
    assert call.call_count == 1


def test_retry_exhausted():
    call = Mock(side_effect=RequestError("unavailable", 503, ""))
    with pytest.raises(AttachmentError) as exc:
        storage.storage_request(call)
    assert exc.value.status_code == 503
    assert call.call_count == 2


@pytest.mark.parametrize(
    "key", ["../key", "a/b", "https://host/key", "a%2fb", "", "a.b", "a?b", "a" * 256]
)
def test_invalid_keys(key):
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
        {"custom": {"kind": "image", "validation_version": "1"}},
        {"content_type": "text/html"},
        {"compression": "zstd"},
        {"filename": None},
        {"size": None},
    ],
)
def test_unverified_metadata(overrides):
    with pytest.raises(AttachmentError):
        storage.from_metadata(metadata(**overrides))


def test_metadata_cache_scoped_and_missing_not_cached():
    cache.clear()
    with patch(
        "sentry.seer.attachments.storage.head",
        side_effect=[storage.from_metadata(metadata()), None, None, None],
    ) as head:
        found, missing = storage.metadata_batch(["key", "missing"])
        assert found[0]["key"] == "key"
        assert missing == ["missing"]
        assert storage.metadata_batch(["key", "missing"]) == (found, missing)
        assert head.call_count == 3
        with viewer_context_scope(ViewerContext(organization_id=456)):
            assert storage.metadata_batch(["key"]) == ([], ["key"])
    assert head.call_count == 4


def test_cache_ttl():
    with (
        patch("sentry.seer.attachments.storage.cache") as cache_mock,
        patch(
            "sentry.seer.attachments.storage.head", return_value=storage.from_metadata(metadata())
        ),
    ):
        cache_mock.get_many.return_value = {}
        storage.metadata_batch(["key"])
    assert cache_mock.set.call_args.kwargs == {"timeout": 300}


def test_batch_storage_failure_is_not_partial_success():
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


def test_head_concurrency_and_viewer_propagation():
    cache.clear()
    lock = Lock()
    active = 0
    peak = 0

    def head(key, *, store):
        nonlocal active, peak
        assert storage.organization_id() == 123
        with lock:
            active += 1
            peak = max(peak, active)
        sleep(0.01)
        with lock:
            active -= 1
        return None

    with patch("sentry.seer.attachments.storage.head", side_effect=head):
        found, missing = storage.metadata_batch([str(n) for n in range(50)])
    assert not found
    assert len(missing) == 50
    assert 1 < peak <= 8


@pytest.mark.parametrize("keys", [[], [str(n) for n in range(51)]])
def test_batch_limit(keys):
    with pytest.raises(AttachmentError):
        storage.metadata_batch(keys)


def test_chat_always_uses_fresh_head():
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
def test_chat_key_limits(keys, code):
    with (
        patch("sentry.seer.attachments.storage.head") as head,
        pytest.raises(AttachmentError) as exc,
    ):
        storage.validate_message(keys, "hello")
    assert exc.value.code == code
    head.assert_not_called()


def test_chat_image_only_and_aggregate_boundary():
    attachment = replace(storage.from_metadata(metadata()), size=3 * 1024 * 1024)
    with patch("sentry.seer.attachments.storage.head", return_value=attachment):
        storage.validate_message(["a", "b", "c", "d"], "")
        with pytest.raises(AttachmentError) as exc:
            storage.validate_message(["a", "b", "c", "d", "e"], "hello")
    assert exc.value.code == "message_too_large"
    assert exc.value.status_code == 413


@pytest.mark.parametrize(
    "kind,mime",
    [("json", "application/json"), ("markdown", "text/markdown"), ("pdf", "application/pdf")],
)
def test_nonimages_require_text(kind, mime):
    attachment = Attachment("file", mime, 10, kind, page_count=1)
    with patch("sentry.seer.attachments.storage.head", return_value=attachment):
        with pytest.raises(AttachmentError) as exc:
            storage.validate_message(["a"], "  ")
        storage.validate_message(["a"], "hello")
    assert exc.value.code == "query_required"


def test_current_limits_rechecked():
    with (
        patch(
            "sentry.seer.attachments.storage.head", return_value=storage.from_metadata(metadata())
        ),
        override_options({"seer.attachments.max-image-bytes": 99}),
        pytest.raises(AttachmentError) as exc,
    ):
        storage.validate_message(["key"], "hello")
    assert exc.value.status_code == 413


def test_read_closes_payload():
    payload = BytesIO(b"hello")
    with patch("sentry.seer.attachments.storage.session") as session:
        session.return_value.get.return_value = GetResponse(metadata(size=5), payload)
        assert storage.read("key")[0] == b"hello"
    assert payload.closed


def test_read_closes_payload_on_error():
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


@requires_objectstore
def test_objectstore_roundtrip():
    original = b"{not valid json, untouched\r\n"
    attachment = Attachment("original.json", "application/json", len(original), "json")
    key = storage.put(original, attachment)
    session = storage.session()
    try:
        stored = session.head(key)
        assert stored is not None
        assert stored.filename == attachment.filename
        assert stored.content_type == attachment.content_type
        assert stored.size == len(original)
        assert stored.compression is None
        assert stored.expiration_policy == TimeToIdle(timedelta(days=91))
        assert stored.custom == attachment.custom_metadata()
        assert storage.read(key) == (original, attachment)
        assert get_org_session(UsecaseId.SEER_ATTACHMENTS, 456, timeout=5).head(key) is None
    finally:
        session.delete(key)


def test_long_opaque_key_fits_metadata_cache():
    with patch("sentry.seer.attachments.storage.head", return_value=None):
        assert storage.metadata_batch(["a" * 255]) == ([], ["a" * 255])


def test_objectstore_existing_client_settings_preserved():
    from django.test import override_settings

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

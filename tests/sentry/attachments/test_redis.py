import zlib
from unittest import mock

import pytest

from sentry.attachments.redis import RedisClusterAttachmentCache
from sentry.cache.redis import RedisClusterCache
from sentry.utils.redis import redis_clusters

KEY_FMT = "c:1:%s"


class FakeClient:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data[key]


@pytest.fixture
def mock_client():
    return FakeClient()


@pytest.fixture
def mocked_attachment_cache(request, mock_client):
    with (
        mock.patch.object(redis_clusters, "get", return_value=mock_client) as cluster_get,
        mock.patch.object(
            redis_clusters, "get_binary", return_value=mock_client
        ) as cluster_get_binary,
    ):
        attachment_cache = RedisClusterAttachmentCache()
    cluster_get.assert_called_once_with("rc-short")
    cluster_get_binary.assert_called_once_with("rc-short")
    assert isinstance(attachment_cache.inner, RedisClusterCache)

    assert attachment_cache.inner._text_client is mock_client
    yield attachment_cache


def test_process_pending_one_batch(mocked_attachment_cache, mock_client):
    mock_client.data[KEY_FMT % "foo:a"] = '[{"name":"foo.txt","content_type":"text/plain"}]'
    mock_client.data[KEY_FMT % "foo:a:0"] = zlib.compress(b"Hello World!")

    (attachment,) = mocked_attachment_cache.get("foo")
    assert attachment.meta() == {
        "id": 0,
        "type": "event.attachment",
        "name": "foo.txt",
        "content_type": "text/plain",
    }
    assert attachment.data == b"Hello World!"


def test_chunked(mocked_attachment_cache, mock_client):
    mock_client.data[KEY_FMT % "foo:a"] = (
        '[{"name":"foo.txt","content_type":"text/plain","chunks":3}]'
    )
    mock_client.data[KEY_FMT % "foo:a:0:0"] = zlib.compress(b"Hello World!")
    mock_client.data[KEY_FMT % "foo:a:0:1"] = zlib.compress(b" This attachment is ")
    mock_client.data[KEY_FMT % "foo:a:0:2"] = zlib.compress(b"chunked up.")

    (attachment,) = mocked_attachment_cache.get("foo")
    assert attachment.meta() == {
        "id": 0,
        "chunks": 3,
        "type": "event.attachment",
        "name": "foo.txt",
        "content_type": "text/plain",
    }
    assert attachment.data == b"Hello World! This attachment is chunked up."

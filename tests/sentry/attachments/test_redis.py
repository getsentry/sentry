import zlib
from unittest import mock

import pytest

from sentry.cache.redis import RbCache, RedisClusterCache
from sentry.utils.imports import import_string

KEY_FMT = "c:1:%s"


class FakeClient:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data[key]


@pytest.fixture
def mock_client():
    return FakeClient()


@pytest.fixture(params=["rb", "rediscluster"])
def mocked_attachment_cache(request, mock_client):
    class RbCluster:
        def get_routing_client(self):
            return mock_client

    if request.param == "rb":
        with mock.patch(
            "sentry.cache.redis.get_cluster_from_options", return_value=(RbCluster(), {})
        ) as cluster_get:
            attachment_cache = import_string("sentry.attachments.redis.RbAttachmentCache")(hosts=[])
            cluster_get.assert_any_call("SENTRY_CACHE_OPTIONS", {"hosts": []})
            assert isinstance(attachment_cache.inner, RbCache)

    elif request.param == "rediscluster":
        with mock.patch(
            "sentry.utils.redis.redis_clusters.get", return_value=mock_client
        ) as cluster_get:
            attachment_cache = import_string(
                "sentry.attachments.redis.RedisClusterAttachmentCache"
            )()
            cluster_get.assert_any_call("rc-short")
            assert isinstance(attachment_cache.inner, RedisClusterCache)

    else:
        assert False

    assert attachment_cache.inner.client is mock_client
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
    mock_client.data[
        KEY_FMT % "foo:a"
    ] = '[{"name":"foo.txt","content_type":"text/plain","chunks":3}]'
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

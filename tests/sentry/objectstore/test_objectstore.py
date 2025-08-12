import pytest
import zstandard

from sentry.objectstore.service import ClientBuilder, ClientError
from sentry.testutils.skips import requires_objectstore

pytestmark = [requires_objectstore]


class Testserver:
    url = "http://localhost:8888"
    secret = ""


def test_stores_uncompressed():
    server = Testserver()
    client = ClientBuilder(
        "test", {"base_url": server.url, "jwt_secret": server.secret}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body, "foo", compression="none")
    assert stored_id == "foo"

    result = client.get("foo")

    assert result.metadata.compression is None
    assert result.payload.read() == b"oh hai!"


def test_uses_zstd_by_default():
    server = Testserver()
    client = ClientBuilder(
        "test", {"base_url": server.url, "jwt_secret": server.secret}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body, "foo")
    assert stored_id == "foo"

    # when the user indicates that it does not want decompression, it gets zstd
    result = client.get("foo", decompress=False)

    assert result.metadata.compression == "zstd"
    assert zstandard.decompress(result.payload.read(), 1024) == b"oh hai!"

    # otherwise, the client does the decompression
    result = client.get("foo")

    assert result.metadata.compression is None
    assert result.payload.read() == b"oh hai!"


def test_deletes_stored_stuff():
    server = Testserver()
    client = ClientBuilder(
        "test", {"base_url": server.url, "jwt_secret": server.secret}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body, "foo")
    assert stored_id == "foo"

    client.delete("foo")

    with pytest.raises(ClientError):
        client.get("foo")

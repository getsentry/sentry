import pytest
import zstandard

from sentry.objectstore.service import ClientBuilder, ClientError
from sentry.testutils.skips import requires_objectstore

pytestmark = [requires_objectstore]


class Testserver:
    url = "http://localhost:8888"
    secret = ""


def test_stores_uncompressed() -> None:
    server = Testserver()
    client = ClientBuilder(
        "test", {"base_url": server.url, "jwt_secret": server.secret}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body, compression="none")

    result = client.get(stored_id)

    assert result.metadata.compression is None
    assert result.payload.read() == b"oh hai!"


def test_uses_zstd_by_default() -> None:
    server = Testserver()
    client = ClientBuilder(
        "test", {"base_url": server.url, "jwt_secret": server.secret}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body)

    # when the user indicates that it does not want decompression, it gets zstd
    result = client.get(stored_id, decompress=False)

    assert result.metadata.compression == "zstd"
    assert zstandard.decompress(result.payload.read(), 1024) == b"oh hai!"

    # otherwise, the client does the decompression
    result = client.get(stored_id)

    assert result.metadata.compression is None
    assert result.payload.read() == b"oh hai!"


def test_deletes_stored_stuff() -> None:
    server = Testserver()
    client = ClientBuilder(
        "test", {"base_url": server.url, "jwt_secret": server.secret}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body)

    client.delete(stored_id)

    with pytest.raises(ClientError):
        client.get(stored_id)

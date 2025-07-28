import zstandard

from sentry.objectstore.service import ObjectStoreService


class Testserver:
    url = "http://localhost:8888"


def test_stores_uncompressed():
    server = Testserver()
    client = ObjectStoreService(
        "test", {"base_url": server.url, "jwt_secret": "TEST"}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body, "foo", compression="uncompressible")
    assert stored_id == "foo"

    result = client.get("foo")

    assert result.compression is None
    assert result.payload.read() == b"oh hai!"


def test_uses_zstd_by_default():
    server = Testserver()
    client = ObjectStoreService(
        "test", {"base_url": server.url, "jwt_secret": "TEST"}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body, "foo")
    assert stored_id == "foo"

    # when the user indicates that it can deal with zstd, it gets zstd
    result = client.get("foo", ["zstd"])

    assert result.compression == "zstd"
    assert zstandard.decompress(result.payload.read()) == b"oh hai!"

    # otherwise, the client does the decompression
    result = client.get("foo")

    assert result.compression is None
    assert result.payload.read() == b"oh hai!"


def test_stores_compressed_zstd():
    server = Testserver()
    client = ObjectStoreService(
        "test", {"base_url": server.url, "jwt_secret": "TEST"}
    ).for_organization(12345)

    body = zstandard.compress(b"oh hai!")
    stored_id = client.put(body, "foo", compression="zstd")
    assert stored_id == "foo"

    # when the user indicates that it can deal with zstd, it gets zstd
    result = client.get("foo", ["zstd"])

    assert result.compression == "zstd"
    assert result.payload.read() == body

    # otherwise, the client does the decompression
    result = client.get("foo")

    assert result.compression is None
    assert result.payload.read() == b"oh hai!"


def test_deletes_stores_stuff():
    server = Testserver()
    client = ObjectStoreService(
        "test", {"base_url": server.url, "jwt_secret": "TEST"}
    ).for_organization(12345)

    body = b"oh hai!"
    stored_id = client.put(body, "foo")
    assert stored_id == "foo"

    client.delete("foo")

    # TODO: assert that we get a NotFound error
    print(client.get("foo"))

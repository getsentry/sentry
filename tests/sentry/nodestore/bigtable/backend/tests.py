import pytest

from sentry.nodestore.bigtable.backend import BigtableNodeStorage
from sentry.utils.cache import memoize
from sentry.utils.compat import mock


class MockedBigtableNodeStorage(BigtableNodeStorage):
    class Cell(object):
        def __init__(self, value, timestamp):
            self.value = value
            self.timestamp = timestamp

    class Row(object):
        def __init__(self, connection, row_key):
            self.row_key = row_key.encode("utf8")
            self.connection = connection

        def delete(self):
            self.connection._table.pop(self.row_key, None)

        def set_cell(self, family, col, value, timestamp):
            assert family == "x"
            self.connection._table.setdefault(self.row_key, {})[col] = [
                MockedBigtableNodeStorage.Cell(value, timestamp)
            ]

        def commit(self):
            # commits not implemented, changes are applied immediately
            pass

        @property
        def cells(self):
            return {"x": dict(self.connection._table.get(self.row_key) or ())}

    class Connection(object):
        def __init__(self):
            self._table = {}

        def row(self, key):
            return MockedBigtableNodeStorage.Row(self, key)

        def read_row(self, key):
            return MockedBigtableNodeStorage.Row(self, key)

        def read_rows(self, row_set):
            assert not row_set.row_ranges, "unsupported"
            return [self.read_row(key) for key in row_set.row_keys]

        def mutate_rows(self, rows):
            # commits not implemented, changes are applied immediately
            pass

    @memoize
    def connection(self):
        return MockedBigtableNodeStorage.Connection()

    def bootstrap(self):
        pass


@pytest.fixture(params=[MockedBigtableNodeStorage, BigtableNodeStorage])
def ns(request):
    if request.param is BigtableNodeStorage:
        pytest.skip("Bigtable is not available in CI")

    ns = request.param(project="test")
    ns.bootstrap()
    return ns


@pytest.mark.parametrize(
    "compression,expected_prefix",
    [(True, (b"\x78\x01", b"\x78\x9c", b"\x78\xda")), (False, b"{"), ("zstd", b"\x28\xb5\x2f\xfd")],
    ids=["zlib", "ident", "zstd"],
)
def test_get(ns, compression, expected_prefix):
    ns.compression = compression
    node_id = "node_id"
    data = {"foo": "bar"}
    ns.set(node_id, data)

    # Make sure this value does not get used during read. We may have various
    # forms of compression in bigtable.
    ns.compression = lambda: 1 / 0
    # Do not use cache as that entirely bypasses what we want to test here.
    ns.cache = None
    assert ns.get(node_id) == data

    raw_data = ns.connection.read_row("node_id").cells["x"][b"0"][0].value
    assert raw_data.startswith(expected_prefix)


def test_cache(ns):
    node_1 = ("a" * 32, {"foo": "a"})
    node_2 = ("b" * 32, {"foo": "b"})
    node_3 = ("c" * 32, {"foo": "c"})

    for node_id, data in [node_1, node_2, node_3]:
        ns.set(node_id, data)

    # Get / get multi populates cache
    assert ns.get(node_1[0]) == node_1[1]
    assert ns.get_multi([node_2[0], node_3[0]]) == {
        node_2[0]: node_2[1],
        node_3[0]: node_3[1],
    }
    with mock.patch.object(ns.connection, "read_row") as mock_read_row:
        assert ns.get(node_1[0]) == node_1[1]
        assert ns.get(node_2[0]) == node_2[1]
        assert ns.get(node_3[0]) == node_3[1]
        assert mock_read_row.call_count == 0

    with mock.patch.object(ns.connection, "read_rows") as mock_read_rows:
        assert ns.get_multi([node_1[0], node_2[0], node_3[0]])
        assert mock_read_rows.call_count == 0

    # Manually deleted item should still retrievable from cache
    row = ns.connection.row(node_1[0])
    row.delete()
    row.commit()
    assert ns.get(node_1[0]) == node_1[1]
    assert ns.get_multi([node_1[0], node_2[0]]) == {
        node_1[0]: node_1[1],
        node_2[0]: node_2[1],
    }

    # Deletion clears cache
    ns.delete(node_1[0])
    assert ns.get_multi([node_1[0], node_2[0]]) == {node_1[0]: None, node_2[0]: node_2[1]}
    ns.delete_multi([node_1[0], node_2[0]])
    assert ns.get_multi([node_1[0], node_2[0]]) == {node_1[0]: None, node_2[0]: None}

    # Setting the item updates cache
    new_value = {"event_id": "d" * 32}
    ns.set(node_1[0], new_value)
    with mock.patch.object(ns.connection, "read_row") as mock_read_row:
        assert ns.get(node_1[0]) == new_value
        assert mock_read_row.call_count == 0

    # Missing rows are never cached
    assert ns.get("node_4") is None
    with mock.patch.object(ns.connection, "read_row") as mock_read_row:
        mock_read_row.return_value = None
        ns.get("node_4")
        ns.get("node_4")
        assert mock_read_row.call_count == 2

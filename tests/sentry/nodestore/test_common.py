"""
Testsuite of backend-independent nodestore tests. Add your backend to the
`ns` fixture to have it tested.
"""
import pytest
from contextlib import contextmanager
from sentry.nodestore.django.backend import DjangoNodeStorage
from tests.sentry.nodestore.bigtable.backend.tests import (
    MockedBigtableNodeStorage,
    get_temporary_bigtable_nodestorage,
)


@contextmanager
def nullcontext(returning):
    # TODO: Replace with ``contextlib.nullcontext`` after upgrading to 3.7
    yield returning


@pytest.fixture(
    params=["bigtable-mocked", "bigtable-real", pytest.param("django", marks=pytest.mark.django_db)]
)
def ns(request):
    # backends are returned from context managers to support teardown when required
    backends = {
        "bigtable-mocked": lambda: nullcontext(MockedBigtableNodeStorage(project="test")),
        "bigtable-real": lambda: get_temporary_bigtable_nodestorage(),
        "django": lambda: nullcontext(DjangoNodeStorage()),
    }

    ctx = backends[request.param]()
    with ctx as ns:
        ns.bootstrap()
        yield ns


def test_get_multi(ns):
    nodes = [("a" * 32, {"foo": "a"}), ("b" * 32, {"foo": "b"})]

    ns.set(nodes[0][0], nodes[0][1])
    ns.set(nodes[1][0], nodes[1][1])

    result = ns.get_multi([nodes[0][0], nodes[1][0]])
    assert result == {n[0]: n[1] for n in nodes}


def test_set(ns):
    node_id = "d2502ebbd7df41ceba8d3275595cac33"
    data = {"foo": "bar"}
    ns.set(node_id, data)
    assert ns.get(node_id) == data


def test_delete(ns):
    node_id = "d2502ebbd7df41ceba8d3275595cac33"
    data = {"foo": "bar"}
    ns.set(node_id, data)
    assert ns.get(node_id) == data
    ns.delete(node_id)
    assert not ns.get(node_id)


def test_delete_multi(ns):
    nodes = [("node_1", {"foo": "a"}), ("node_2", {"foo": "b"})]

    for n in nodes:
        ns.set(n[0], n[1])

    ns.delete_multi([nodes[0][0], nodes[1][0]])
    assert not ns.get(nodes[0][0])
    assert not ns.get(nodes[1][0])


def test_set_subkeys(ns):
    """
    Subkeys are used to store multiple JSON payloads under the same main key.
    The usual guarantee is that those payloads are compressed together and are
    fetched/saved together, however based on which is needed only one is
    actually deserialized.

    This is used in reprocessing to store the raw, unprocessed event payload
    alongside with the main event payload. Since those payloads probably
    overlap to a great extent, compression is often better than storing them
    separately.
    """

    ns.set_subkeys("node_1", {None: {"foo": "a"}, "other": {"foo": "b"}})
    assert ns.get("node_1") == {"foo": "a"}
    assert ns.get("node_1", subkey="other") == {"foo": "b"}

    ns.set("node_1", {"foo": "a"})
    assert ns.get("node_1") == {"foo": "a"}
    assert ns.get("node_1", subkey="other") is None

    ns.delete("node_1")
    assert ns.get("node_1") is None
    assert ns.get("node_1", subkey="other") is None

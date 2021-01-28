from __future__ import absolute_import

"""
Testsuite of backend-independent nodestore tests. Add your backend to the
`ns` fixture to have it tested.
"""

from sentry.nodestore.django.backend import DjangoNodeStorage
from sentry.nodestore.bigtable.backend import BigtableNodeStorage
from tests.sentry.nodestore.bigtable.backend.tests import MockedBigtableNodeStorage

import pytest


@pytest.fixture(
    params=["bigtable-mocked", "bigtable-real", pytest.param("django", marks=pytest.mark.django_db)]
)
def ns(request):
    if request.param == "bigtable-real":
        pytest.skip("Bigtable is not available in CI")

    ns = {
        "bigtable-mocked": lambda: MockedBigtableNodeStorage(project="test"),
        "bigtable-real": lambda: BigtableNodeStorage(project="test"),
        "django": lambda: DjangoNodeStorage(),
    }[request.param]()
    ns.bootstrap()
    return ns


def test_get_multi(ns):
    nodes = [("a" * 32, {"foo": "a"}), ("b" * 32, {"foo": "b"})]

    ns.set(nodes[0][0], nodes[0][1])
    ns.set(nodes[1][0], nodes[1][1])

    result = ns.get_multi([nodes[0][0], nodes[1][0]])
    assert result == dict((n[0], n[1]) for n in nodes)


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

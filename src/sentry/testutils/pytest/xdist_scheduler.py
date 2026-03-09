"""Deterministic xdist scheduler for Sentry.

Round-robins individual test nodeids to workers, preserving the collection
order from pytest_collection_modifyitems.  Each worker receives its full
workload upfront.  This guarantees:

1. Every run with the same collection produces identical worker assignments.
2. No dynamic load-balancing or shuffling.
3. Even distribution: test i goes to worker i % n.

Unlike xdist's built-in schedulers, this one tolerates minor ordering
differences between worker collections (caused by set/dict-based
``pytest.mark.parametrize``) by comparing sorted collections instead of
requiring identical order.
"""

from __future__ import annotations

from collections import OrderedDict

from xdist.remote import Producer
from xdist.workermanage import parse_spec_config


class DeterministicScheduling:
    """Distribute tests deterministically: round-robin by nodeid, all work sent upfront."""

    def __init__(self, config, log=None):
        self.numnodes = len(parse_spec_config(config))
        self.collection: list[str] | None = None
        self.registered_collections: OrderedDict = OrderedDict()
        self.assigned_work: OrderedDict = OrderedDict()
        self._pending: dict = {}
        self.config = config

        if log is None:
            self.log = Producer("deterministicsched")
        else:
            self.log = log.deterministicsched

    # -- properties required by DSession ------------------------------------

    @property
    def nodes(self):
        return list(self.assigned_work.keys())

    @property
    def collection_is_completed(self):
        return len(self.registered_collections) >= self.numnodes

    @property
    def tests_finished(self):
        if not self.collection_is_completed:
            return False
        return all(p == 0 for p in self._pending.values())

    @property
    def has_pending(self):
        return any(p > 0 for p in self._pending.values())

    # -- node management ----------------------------------------------------

    def add_node(self, node):
        assert node not in self.assigned_work
        self.assigned_work[node] = OrderedDict()
        self._pending[node] = 0

    def remove_node(self, node):
        workload = self.assigned_work.pop(node, OrderedDict())
        self._pending.pop(node, None)

        # Find the crashing test if any pending work remains.
        for nodeid, completed in workload.items():
            if not completed:
                return nodeid
        return None

    def add_node_collection(self, node, collection):
        assert node in self.assigned_work

        if self.collection_is_completed:
            assert self.collection
            if set(collection) != set(self.collection):
                self.log(
                    "Worker %s collected different tests (got %d, expected %d)"
                    % (node.gateway.id, len(collection), len(self.collection))
                )
                return

        self.registered_collections[node] = list(collection)

    # -- test tracking ------------------------------------------------------

    def mark_test_complete(self, node, item_index, duration=0):
        nodeid = self.registered_collections[node][item_index]
        self.assigned_work[node][nodeid] = True
        self._pending[node] -= 1

    def mark_test_pending(self, item):
        raise NotImplementedError()

    # -- scheduling ---------------------------------------------------------

    def schedule(self):
        assert self.collection_is_completed

        if self.collection is not None:
            return

        if not self._check_nodes_have_same_collection():
            self.log("**Different tests collected, aborting run**")
            return

        # Use sorted collection as canonical order so all workers agree.
        first_collection = next(iter(self.registered_collections.values()))
        self.collection = sorted(first_collection)
        if not self.collection:
            return

        active_nodes = list(self.nodes)

        # Shut down excess nodes.
        while len(active_nodes) > len(self.collection):
            excess = active_nodes.pop()
            self.assigned_work.pop(excess, None)
            self._pending.pop(excess, None)
            excess.shutdown()

        # Build nodeid→index lookup per worker for O(1) translation.
        node_index_maps: dict = {}
        for node in active_nodes:
            node_index_maps[node] = {
                nid: idx for idx, nid in enumerate(self.registered_collections[node])
            }

        # Round-robin: test i goes to worker i % n.
        node_indices: dict = {node: [] for node in active_nodes}
        for i, nodeid in enumerate(self.collection):
            node = active_nodes[i % len(active_nodes)]
            self.assigned_work[node][nodeid] = False
            self._pending[node] = self._pending.get(node, 0) + 1
            node_indices[node].append(node_index_maps[node][nodeid])

        # Send all work to each node then immediately tell it to shut down.
        # The xdist worker only runs its last queued test upon receiving
        # the "shutdown" command (see xdist/remote.py pytest_runtestloop).
        for node, indices in node_indices.items():
            if indices:
                node.send_runtest_some(indices)
            node.shutdown()

    # -- helpers ------------------------------------------------------------

    def _check_nodes_have_same_collection(self):
        """Verify all nodes collected the same set of tests.

        Unlike xdist's default check, this compares sorted collections to
        tolerate ordering differences from hash randomization in set/dict
        parametrize arguments.
        """
        node_collection_items = list(self.registered_collections.items())
        first_node, col = node_collection_items[0]
        reference = sorted(col)
        same_collection = True

        for node, collection in node_collection_items[1:]:
            if sorted(collection) != reference:
                same_collection = False
                ref_set = set(col)
                other_set = set(collection)
                only_first = ref_set - other_set
                only_second = other_set - ref_set
                self.log(
                    "Collection mismatch between %s and %s: "
                    "only in %s: %s, only in %s: %s"
                    % (
                        first_node.gateway.id,
                        node.gateway.id,
                        first_node.gateway.id,
                        only_first,
                        node.gateway.id,
                        only_second,
                    )
                )

        return same_collection

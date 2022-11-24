from collections import UserDict, defaultdict
from typing import Iterable

from .base import Clusterer

__all__ = ["TreeClusterer"]


#: Symbol representing a merged node
MERGED = None


class TreeClusterer(Clusterer):
    def __init__(self, merge_threshold: int) -> None:
        self._merge_threshold = merge_threshold
        self._graph = Node()

    def add_input(self, transaction_names: Iterable[str]) -> None:
        for tx_name in transaction_names:
            parts = tx_name.strip("/").split("/")
            node = self._graph
            for part in parts:
                node = node.setdefault(part, Node())

    def get_rules(self) -> None:
        self._graph.merge(self._merge_threshold)


class Node(UserDict):
    """Keys in this dict are names of the children"""

    def merge(self, merge_threshold: int) -> None:
        """Recursively merge children of high-cardinality nodes"""
        if len(self) >= merge_threshold:
            self[:] = {MERGED: self._merge_nodes(self.values())}

        for child in self.values():
            child.merge(merge_threshold)

    @classmethod
    def _merge_nodes(cls, nodes: Iterable["Node"]) -> "Node":
        children_by_name = defaultdict(list)
        for node in nodes:
            for name, child in node.items():
                children_by_name[name].append(child)

        return Node(
            {name: cls._merge_nodes(children) for name, children in children_by_name.items()}
        )

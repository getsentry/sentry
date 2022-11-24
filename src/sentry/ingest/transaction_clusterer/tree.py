from collections import UserDict, defaultdict
from typing import Iterable, List, Optional, Union

from .base import Clusterer, ReplacementRule

__all__ = ["TreeClusterer"]


#: Symbol representing a merged node
MERGED = None


# TODO: Metrics for tree size, spans for merge, etc.


class TreeClusterer(Clusterer):
    def __init__(self, *, merge_threshold: int) -> None:
        self._merge_threshold = merge_threshold
        self._graph = Node()

    def add_input(self, transaction_names: Iterable[str]) -> None:
        for tx_name in transaction_names:
            parts = tx_name.strip("/").split("/")
            node = self._graph
            for part in parts:
                node = node.setdefault(part, Node())

    def get_rules(self) -> List[ReplacementRule]:
        """Merge high-cardinality nodes in the graph and extract rules"""
        self._graph.merge(self._merge_threshold)
        # Generate exactly 1 rule for every merge
        rule_paths = [path for path in self._graph.paths() if path[-1] == MERGED]

        # Sort by path length, descending (most specific rule first)
        rule_paths.sort(key=len, reverse=True)

        return [self._build_rule(path) for path in rule_paths]

    @staticmethod
    def _build_rule(path: List["Node.Key"]) -> ReplacementRule:
        return ReplacementRule("/" + "/".join(["*" if key == MERGED else key for key in path]))


class Node(UserDict):
    """Keys in this dict are names of the children"""

    Key = Union[str, type(MERGED)]

    def paths(self, ancestors: Optional[List[Key]] = None) -> Iterable[List[Key]]:
        """Collect all paths and subpaths through the graph"""
        if ancestors is None:
            ancestors = []
        for name, child in self.items():
            path = ancestors + [name]
            yield path
            yield from child.paths(ancestors=path)

    def merge(self, merge_threshold: int) -> None:
        """Recursively merge children of high-cardinality nodes"""
        if len(self) >= merge_threshold:
            merged_children = self._merge_nodes(self.values())
            self.clear()
            self[MERGED] = merged_children

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

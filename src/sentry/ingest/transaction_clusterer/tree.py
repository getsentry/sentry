""" Build a directory tree from URL patterns and merge nodes with many siblings.

For example, a blog project might contain transaction names along the lines of:

/users/my-user-name/posts/2022-01-01-that-one-time-i-did-something

We build a tree that looks like this:

/users
  /my-user-name
    /posts
      /2022-01-01-that-one-time-i-did-something
  /my-user-name2
    /posts
      /2022-12-31-i-did-something-too
  /my-user-name3
    /posts
      /2022-07-15-but-what-about-me
    /settings

As soon as the node /users has reached the threshold of X children, we merge them:

/users
  /*
    /posts
      /2022-01-01-that-one-time-i-did-something
      /2022-12-31-i-did-something-too
      /2022-07-15-but-what-about-me
    /settings

If /posts now also has reached the threshold of X children, those are merged as well:

/users
  /*
    /posts
      *
    /settings

Resulting in the following replacement rules:

/users/*/posts/*/**  # To replace both identifiers
/users/*/**          # For URLs with only one identifier, e.g. /users/*/settings

The replacement rules are interpreted by Relay to match and replace `*`, and to match but ignore `**`.

"""

import logging
from collections import UserDict, defaultdict
from typing import Iterable, List, Optional, Union

import sentry_sdk
from typing_extensions import TypeAlias

from .base import Clusterer, ReplacementRule
from .rule_validator import RuleValidator

__all__ = ["TreeClusterer"]


class Merged:
    pass


#: Symbol representing a merged node
MERGED = Merged()

#: Separator by which we build the tree
SEP = "/"


logger = logging.getLogger(__name__)


class TreeClusterer(Clusterer):
    def __init__(self, *, merge_threshold: int) -> None:
        self._merge_threshold = merge_threshold
        self._tree = Node()
        self._rules: Optional[List[ReplacementRule]] = None

    def add_input(self, transaction_names: Iterable[str]) -> None:
        for tx_name in transaction_names:
            parts = tx_name.split(SEP)
            node = self._tree
            for part in parts:
                node = node.setdefault(part, Node())

    def get_rules(self) -> List[ReplacementRule]:
        """Computes the rules for the current tree."""
        self._extract_rules()
        self._clean_rules()
        self._sort_rules()

        assert self._rules is not None  # Keep mypy happy
        return self._rules

    def _extract_rules(self) -> None:
        """Merge high-cardinality nodes in the graph and extract rules"""
        with sentry_sdk.start_span(op="txcluster_merge"):
            self._tree.merge(self._merge_threshold)

        # Generate exactly 1 rule for every merge
        rule_paths = [path for path in self._tree.paths() if path[-1] is MERGED]
        self._rules = [self._build_rule(path) for path in rule_paths]

    def _clean_rules(self) -> None:
        """Deletes the rules that are not valid."""
        if not self._rules:
            return
        self._rules = [rule for rule in self._rules if RuleValidator(rule).is_valid()]

    def _sort_rules(self) -> None:
        """Sorts the rules by path length, descending (most specific rule first)."""
        if not self._rules:
            return
        self._rules.sort(key=len, reverse=True)

    @staticmethod
    def _build_rule(path: List["Edge"]) -> ReplacementRule:
        path_str = SEP.join(["*" if isinstance(key, Merged) else key for key in path])
        path_str += "/**"
        return ReplacementRule(path_str)


#: Represents the edges between graph nodes. These edges serve as keys in the
#: node dictionary.
Edge: TypeAlias = Union[str, Merged]


class Node(UserDict):  # type: ignore
    """Keys in this dict are names of the children"""

    def paths(self, ancestors: Optional[List[Edge]] = None) -> Iterable[List[Edge]]:
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

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, Optional, Sequence, Union

from sentry.utils.safe import get_path, safe_execute, set_path

# TODO(3.8): This is a hack so we can get TypedDicts before 3.8
if TYPE_CHECKING:
    from mypy_extensions import TypedDict
else:

    def TypedDict(*args, **kwargs):
        pass


TreeLabelPart = TypedDict(
    "TreeLabelPart",
    {
        "function": str,
        "package": str,
        "is_sentinel": bool,
        "is_prefix": bool,
        "datapath": Sequence[Union[str, int]],
    },
)


TreeLabel = Sequence[TreeLabelPart]


def _strip_tree_label(tree_label: TreeLabel):
    rv = []
    for part in tree_label:
        part = dict(part)
        # TODO(markus): Remove more stuff here if we never use it in group
        # title
        part.pop("datapath", None)
        rv.append(part)

    return rv


def _write_tree_labels(tree_labels: Sequence[TreeLabel], event_data: Dict[str, Any]):
    event_data["hierarchical_tree_labels"] = event_labels = []

    for level, tree_label in enumerate(tree_labels):
        event_labels.append(_strip_tree_label(tree_label))

        for part in tree_label:
            datapath = part["datapath"]
            frame = get_path(event_data, *datapath)
            if not frame:
                raise ValueError("datapath not found in event")

            if part.get("is_sentinel"):
                set_path(frame, "data", "is_sentinel", value=True)

            if part.get("is_prefix"):
                set_path(frame, "data", "is_prefix", value=True)

            prev_level = get_path(frame, "data", "min_grouping_level")
            if not isinstance(prev_level, int) or level < prev_level:
                set_path(frame, "data", "min_grouping_level", value=level)


@dataclass(frozen=True)
class CalculatedHashes:
    hashes: Sequence[str]
    hierarchical_hashes: Sequence[str]
    tree_labels: Sequence[TreeLabel]

    def write_to_event(self, event_data):
        event_data["hashes"] = self.hashes

        if self.hierarchical_hashes:
            event_data["hierarchical_hashes"] = self.hierarchical_hashes

            safe_execute(_write_tree_labels, self.tree_labels, event_data, _with_transaction=False)

    @classmethod
    def from_event(cls, event_data) -> Optional["CalculatedHashes"]:
        hashes = event_data.get("hashes")
        hierarchical_hashes = event_data.get("hierarchical_hashes") or []
        tree_labels = event_data.get("hierarchical_tree_labels") or []
        if hashes is not None:
            return cls(
                hashes=hashes, hierarchical_hashes=hierarchical_hashes, tree_labels=tree_labels
            )

        return None

    @property
    def finest_tree_label(self) -> Optional[TreeLabel]:
        try:
            return _strip_tree_label(self.tree_labels[-1])
        except IndexError:
            return None

    def group_metadata_from_hash(self, hash: str) -> Dict[str, Any]:
        try:
            i = self.hierarchical_hashes.index(hash)
            return {
                "current_level": i,
                "current_tree_label": _strip_tree_label(self.tree_labels[i]),
            }
        except (IndexError, ValueError):
            return {}

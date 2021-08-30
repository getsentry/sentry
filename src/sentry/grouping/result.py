from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Sequence, Union

from sentry.utils.safe import get_path, safe_execute, set_path

# TODO(3.8): This is a hack so we can get TypedDicts before 3.8
if TYPE_CHECKING:
    from mypy_extensions import TypedDict
else:

    def TypedDict(*args, **kwargs):
        pass


EventData = Dict[str, Any]
EventMetadata = Dict[str, Any]


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

StrippedTreeLabelPart = TypedDict(
    "StrippedTreeLabelPart",
    {
        "function": str,
        "package": str,
        "is_sentinel": bool,
        "is_prefix": bool,
    },
)


TreeLabel = Sequence[TreeLabelPart]
StrippedTreeLabel = Sequence[StrippedTreeLabelPart]

# XXX(markus): Because of fallback grouping, people who migrate to new grouping
# algorithm will start grouping at the maximum level as for each issue there
# will be likely one old system- or app-hash that matches the max level (=group
# by all frames). That means that the system will produce extremely long tree
# labels even though the user may not really want or understand any of them.
#
# To get around this, we truncate the tree label down to some arbitrary
# number of functions. This does not apply to the grouping breakdown, as in
# grouping_level_new_issues endpoint we populate the tree labels not through
# this function at all.
#
# The reason we do this on the backend instead of the frontend's title
# component is because JIRA/Slack/Email titles suffer from the same issue:
# After the user migrates to hierarchical grouping, all the issue titles are
# really long, and any created JIRA ticket's title/summary is also really long.
#
# Once people are able to actually split up issues (i.e. set the grouping
# level), we may revisit this type of truncation and replace it with something
# that only kicks in when the found hash is found via fallback grouping. But
# that'd be harder to implement and doesn't need to be solved rn.
MAX_ISSUE_TREE_LABELS = 2


def _strip_tree_label(tree_label: TreeLabel, truncate: bool = False) -> StrippedTreeLabel:
    rv = []
    for part in tree_label:
        stripped_part: StrippedTreeLabelPart = dict(part)  # type: ignore
        # TODO(markus): Remove more stuff here if we never use it in group
        # title
        stripped_part.pop("datapath", None)  # type: ignore
        rv.append(stripped_part)

        if truncate and len(rv) == MAX_ISSUE_TREE_LABELS:
            break

    return rv


def _write_tree_labels(tree_labels: Sequence[Optional[TreeLabel]], event_data: EventData) -> None:
    event_labels: List[Optional[StrippedTreeLabel]] = []
    event_data["hierarchical_tree_labels"] = event_labels

    for level, tree_label in enumerate(tree_labels):
        if tree_label is None:
            event_labels.append(None)
            continue

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
    tree_labels: Sequence[Optional[TreeLabel]]

    def write_to_event(self, event_data: EventData) -> None:
        event_data["hashes"] = self.hashes

        if self.hierarchical_hashes:
            event_data["hierarchical_hashes"] = self.hierarchical_hashes

            safe_execute(_write_tree_labels, self.tree_labels, event_data, _with_transaction=False)

    @classmethod
    def from_event(cls, event_data: EventData) -> Optional["CalculatedHashes"]:
        hashes = event_data.get("hashes")
        hierarchical_hashes = event_data.get("hierarchical_hashes") or []
        tree_labels = event_data.get("hierarchical_tree_labels") or []
        if hashes is not None:
            return cls(
                hashes=hashes, hierarchical_hashes=hierarchical_hashes, tree_labels=tree_labels
            )

        return None

    @property
    def finest_tree_label(self) -> Optional[StrippedTreeLabel]:
        try:
            tree_label = self.tree_labels[-1]
            # Also do this for event title in discover because people may
            # expect to `groupby title` to basically groupby issue.
            return tree_label and _strip_tree_label(tree_label, truncate=True)
        except IndexError:
            return None

    def group_metadata_from_hash(self, hash: str) -> EventMetadata:
        try:
            i = self.hierarchical_hashes.index(hash)
            tree_label = self.tree_labels[i]
            return {
                "current_level": i,
                "current_tree_label": tree_label and _strip_tree_label(tree_label, truncate=True),
            }
        except (IndexError, ValueError):
            return {}

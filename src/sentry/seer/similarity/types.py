import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, ClassVar, NotRequired, Self, TypedDict

from sentry.models.grouphash import GroupHash
from sentry.utils.json import apply_key_filter

logger = logging.getLogger(__name__)


class IncompleteSeerDataError(Exception):
    pass


class SimilarHashNotFoundError(Exception):
    pass


class SimilarHashMissingGroupError(Exception):
    pass


class SimilarIssuesEmbeddingsRequest(TypedDict):
    project_id: int
    stacktrace: str
    exception_type: str | None
    hash: str
    k: NotRequired[int]  # how many neighbors to find
    threshold: NotRequired[float]
    read_only: NotRequired[bool]
    event_id: NotRequired[str]
    referrer: NotRequired[str]
    use_reranking: NotRequired[bool]


class RawSeerSimilarIssueData(TypedDict):
    parent_hash: str
    stacktrace_distance: float
    should_group: bool


class SimilarIssuesEmbeddingsResponse(TypedDict):
    responses: list[RawSeerSimilarIssueData]


# Like the data that comes back from seer, but guaranteed to have an existing parent hash
@dataclass
class SeerSimilarIssueData:
    stacktrace_distance: float
    should_group: bool
    parent_group_id: int
    parent_hash: str

    # Unfortunately, we have to hardcode this separately from the `RawSeerSimilarIssueData` type
    # definition because Python has no way to derive it from the type (nor vice-versa)
    required_incoming_keys: ClassVar = {
        "stacktrace_distance",
        "should_group",
        "parent_hash",
    }
    optional_incoming_keys: ClassVar = {}
    expected_incoming_keys: ClassVar = {*required_incoming_keys, *optional_incoming_keys}

    @classmethod
    def from_raw(cls, project_id: int, raw_similar_issue_data: Mapping[str, Any]) -> Self:
        """
        Create an instance of `SeerSimilarIssueData` from the raw data that comes back from Seer,
        using the parent hash to look up the parent group id. Needs to be run individually on each
        similar issue in the Seer response.

        Throws an `IncompleteSeerDataError` if given data with any required keys missing, a
        `SimilarHashNotFoundError` if the data points to a grouphash which no longer exists, and a
        `SimilarHashMissingGroupError` if the the data points to a grouphash not assigned to a
        group. The latter two guarantee that if this successfully returns, the parent group id in the
        return value points to an existing group.
        """

        # Filter out any data we're not expecting, and then make sure what's left isn't missing anything
        raw_similar_issue_data = apply_key_filter(
            raw_similar_issue_data, keep_keys=cls.expected_incoming_keys
        )
        missing_keys = cls.required_incoming_keys - raw_similar_issue_data.keys()
        if missing_keys:
            raise IncompleteSeerDataError(
                "Seer similar issues response entry missing "
                + ("keys " if len(missing_keys) > 1 else "key ")
                + ", ".join(map(lambda key: f"'{key}'", sorted(missing_keys)))
            )

        # Now that we know we have all the right data, use the parent group's hash to look up its id
        parent_grouphash = (
            GroupHash.objects.filter(
                project_id=project_id, hash=raw_similar_issue_data["parent_hash"]
            )
            .exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
            .first()
        )

        if not parent_grouphash:
            # TODO: Report back to seer that the hash has been deleted.
            raise SimilarHashNotFoundError("Similar hash suggested by Seer does not exist")

        if not parent_grouphash.group_id:
            # TODO: Report back to seer that the hash has been deleted.
            raise SimilarHashMissingGroupError("Similar hash suggested by Seer missing group id")

        # TODO: The `Any` casting here isn't great, but Python currently has no way to
        # relate typeddict keys to dataclass properties
        similar_issue_data: Any = {
            **raw_similar_issue_data,
            "parent_group_id": parent_grouphash.group_id,
        }

        return cls(**similar_issue_data)

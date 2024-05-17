import logging
from dataclasses import asdict

from sentry import features
from sentry.api.endpoints.group_similar_issues_embeddings import get_stacktrace_string
from sentry.constants import PLACEHOLDER_EVENT_TITLES
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info_from_variants
from sentry.grouping.result import CalculatedHashes
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.utils import (
    SeerSimilarIssuesMetadata,
    SimilarIssuesEmbeddingsRequest,
    get_similarity_data_from_seer,
)
from sentry.utils.safe import get_path

logger = logging.getLogger("sentry.events.grouping")


def should_call_seer_for_grouping(event: Event, project: Project) -> bool:
    """
    Use event content, feature flags, rate limits, killswitches, seer health, etc. to determine
    whether a call to Seer should be made.
    """
    # TODO: Implement rate limits, kill switches, other flags, etc
    # TODO: Return False if the event has a custom fingerprint (check for both client- and server-side fingerprints)

    # If an event has no stacktrace, and only one of our placeholder titles ("<untitled>",
    # "<unknown>", etc.), there's no data for Seer to analyze, so no point in making the API call.
    if (
        event.title in PLACEHOLDER_EVENT_TITLES
        and not get_path(event.data, "exception", "values", -1, "stacktrace", "frames")
        and not get_path(event.data, "threads", "values", -1, "stacktrace", "frames")
    ):
        return False

    return features.has("projects:similarity-embeddings-metadata", project) or features.has(
        "projects:similarity-embeddings-grouping", project
    )


def get_seer_similar_issues(
    event: Event,
    primary_hashes: CalculatedHashes,
    num_neighbors: int = 1,
) -> tuple[
    dict[
        str, str | list[dict[str, float | bool | int | str]]
    ],  # a SeerSimilarIssuesMetadata instance, dictified
    Group | None,
]:
    """
    Ask Seer for the given event's nearest neighbor(s) and return the seer response data, sorted
    with the best matches first, along with the group Seer decided the event should go in, if any,
    or None if no neighbor was near enough.

    Will also return `None` for the neighboring group if the `projects:similarity-embeddings-grouping`
    feature flag is off.
    """

    # TODO: In our context, this can never happen. There are other scenarios in which `variants` can
    # be `None`, but where we'll be using this (during ingestion) it's not possible. This check is
    # primarily to satisfy mypy. Once we get rid of hierarchical hashing, we'll be able to
    # make `variants` required in `CalculatedHashes`, meaning we can remove this check. (See note in
    # `CalculatedHashes` class definition.)
    if primary_hashes.variants is None:
        raise Exception("Primary hashes missing variants data")

    event_hash = primary_hashes.hashes[0]
    stacktrace_string = get_stacktrace_string(
        get_grouping_info_from_variants(primary_hashes.variants)
    )

    request_data: SimilarIssuesEmbeddingsRequest = {
        "hash": event_hash,
        "project_id": event.project.id,
        "stacktrace": stacktrace_string,
        "message": event.title,
        "k": num_neighbors,
    }

    # Similar issues are returned with the closest match first
    seer_results = get_similarity_data_from_seer(request_data)

    similar_issues_metadata = asdict(
        SeerSimilarIssuesMetadata(request_hash=event_hash, results=seer_results)
    )
    parent_group = (
        Group.objects.filter(id=seer_results[0].parent_group_id).first()
        if (
            seer_results
            and seer_results[0].should_group
            and features.has("projects:similarity-embeddings-grouping", event.project)
        )
        else None
    )

    return (similar_issues_metadata, parent_group)

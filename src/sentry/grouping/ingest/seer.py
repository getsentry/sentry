import logging
from dataclasses import asdict

from sentry import features, options
from sentry import ratelimits as ratelimiter
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info_from_variants
from sentry.grouping.result import CalculatedHashes
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import SeerSimilarIssuesMetadata, SimilarIssuesEmbeddingsRequest
from sentry.seer.similarity.utils import event_content_is_seer_eligible, get_stacktrace_string
from sentry.utils import metrics

logger = logging.getLogger("sentry.events.grouping")


def should_call_seer_for_grouping(
    event: Event, project: Project, primary_hashes: CalculatedHashes
) -> bool:
    """
    Use event content, feature flags, rate limits, killswitches, seer health, etc. to determine
    whether a call to Seer should be made.
    """
    # TODO: Implement rate limits, kill switches, other flags, etc

    has_either_seer_grouping_feature = features.has(
        "projects:similarity-embeddings-metadata", project
    ) or features.has("projects:similarity-embeddings-grouping", project)

    if not has_either_seer_grouping_feature:
        return False

    # TODO: In our context, this can never happen. There are other scenarios in which `variants` can
    # be `None`, but where we'll be using this (during ingestion) it's not possible. This check is
    # primarily to satisfy mypy. Once we get rid of hierarchical hashing, we'll be able to
    # make `variants` required in `CalculatedHashes`, meaning we can remove this check. (See note in
    # `CalculatedHashes` class definition.)
    if primary_hashes.variants is None:
        raise Exception("Primary hashes missing variants data")

    fingerprint_variant = primary_hashes.variants.get(
        "custom-fingerprint"
    ) or primary_hashes.variants.get("built-in-fingerprint")
    # If there's non-default fingerprint (whether from the user or from us), it should *always*
    # contribute, but can't hurt to cover our bases
    if fingerprint_variant and fingerprint_variant.contributes:
        return False

    if not event_content_is_seer_eligible(event):
        return False

    # The circuit breaker check which might naturally also go here (along with its killswitch and
    # ratelimiting friends) instead happens in the `with_circuit_breaker` helper used where
    # `get_seer_similar_issues` is actually called. (It has to be there in order for it to track
    # errors arising from that call.)
    if _killswitch_enabled(event, project) or _ratelimiting_enabled(event, project):
        return False

    return True


def _killswitch_enabled(event: Event, project: Project) -> bool:
    """
    Check both the global and similarity-specific Seer killswitches.
    """

    logger_extra = {"event_id": event.event_id, "project_id": project.id}

    if options.get("seer.global-killswitch.enabled"):
        logger.warning(
            "should_call_seer_for_grouping.seer_global_killswitch_enabled",
            extra=logger_extra,
        )
        metrics.incr("grouping.similarity.seer_global_killswitch_enabled")
        return True

    if options.get("seer.similarity-killswitch.enabled"):
        logger.warning(
            "should_call_seer_for_grouping.seer_similarity_killswitch_enabled",
            extra=logger_extra,
        )
        metrics.incr("grouping.similarity.seer_similarity_killswitch_enabled")
        return True

    return False


def _ratelimiting_enabled(event: Event, project: Project) -> bool:
    """
    Check both the global and project-based Seer similarity ratelimits.
    """

    global_ratelimit = options.get("seer.similarity.global-rate-limit")
    per_project_ratelimit = options.get("seer.similarity.per-project-rate-limit")

    global_limit_per_sec = global_ratelimit["limit"] / global_ratelimit["window"]
    project_limit_per_sec = per_project_ratelimit["limit"] / per_project_ratelimit["window"]

    logger_extra = {"event_id": event.event_id, "project_id": project.id}

    if ratelimiter.backend.is_limited("seer:similarity:global-limit", **global_ratelimit):
        logger_extra["limit_per_sec"] = global_limit_per_sec
        logger.warning("should_call_seer_for_grouping.global_ratelimit_hit", extra=logger_extra)

        metrics.incr(
            "grouping.similarity.global_ratelimit_hit",
            tags={"limit_per_sec": global_limit_per_sec},
        )

        return True

    if ratelimiter.backend.is_limited(
        f"seer:similarity:project-{project.id}-limit", **per_project_ratelimit
    ):
        logger_extra["limit_per_sec"] = project_limit_per_sec
        logger.warning("should_call_seer_for_grouping.project_ratelimit_hit", extra=logger_extra)

        metrics.incr(
            "grouping.similarity.project_ratelimit_hit",
            tags={"limit_per_sec": project_limit_per_sec},
        )

        return True

    return False


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

import logging
from dataclasses import asdict
from typing import Any

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry import ratelimits as ratelimiter
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info_from_variants
from sentry.grouping.result import CalculatedHashes
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import SimilarIssuesEmbeddingsRequest
from sentry.seer.similarity.utils import (
    event_content_is_seer_eligible,
    filter_null_from_string,
    get_stacktrace_string,
    killswitch_enabled,
)
from sentry.utils import metrics
from sentry.utils.circuit_breaker2 import CircuitBreaker
from sentry.utils.safe import get_path

logger = logging.getLogger("sentry.events.grouping")


def should_call_seer_for_grouping(event: Event, primary_hashes: CalculatedHashes) -> bool:
    """
    Use event content, feature flags, rate limits, killswitches, seer health, etc. to determine
    whether a call to Seer should be made.
    """

    project = event.project

    # Check both of these before returning based on either so we can gather metrics on their results
    content_is_eligible = event_content_is_seer_eligible(event)
    seer_enabled_for_project = _project_has_similarity_grouping_enabled(project)
    if not (content_is_eligible and seer_enabled_for_project):
        return False

    if (
        _has_customized_fingerprint(event, primary_hashes)
        or killswitch_enabled(project.id, event)
        or _circuit_breaker_broken(event, project)
        # **Do not add any new checks after this.** The rate limit check MUST remain the last of all
        # the checks.
        #
        # (Checking the rate limit for calling Seer also increments the counter of how many times
        # we've tried to call it, and if we fail any of the other checks, it shouldn't count as an
        # attempt. Thus we only want to run the rate limit check if every other check has already
        # succeeded.)
        or _ratelimiting_enabled(event, project)
    ):
        return False

    return True


def _project_has_similarity_grouping_enabled(project: Project) -> bool:
    # TODO: This is a hack to get ingest to turn on for projects as soon as they're backfilled. When
    # the backfill script completes, we turn on this option, enabling ingest immediately rather than
    # forcing the project to wait until it's been manually added to a feature handler. Once all
    # projects have been backfilled, the option (and this check) can go away.
    has_been_backfilled = bool(project.get_option("sentry:similarity_backfill_completed"))

    metrics.incr(
        "grouping.similarity.event_project_backfill_status",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={"backfilled": has_been_backfilled},
    )

    return has_been_backfilled


# TODO: Here we're including events with hybrid fingerprints (ones which are `{{ default }}`
# combined with some other value). To the extent to which we're then using this function to decide
# whether or not to call Seer, this means that the calculations giving rise to the default part of
# the value never involve Seer input. In the long run, we probably want to change that.
def _has_customized_fingerprint(event: Event, primary_hashes: CalculatedHashes) -> bool:
    fingerprint = event.data.get("fingerprint", [])

    if "{{ default }}" in fingerprint:
        # No custom fingerprinting at all
        if len(fingerprint) == 1:
            return False

        # Hybrid fingerprinting ({{ default }} + some other value(s))
        else:
            metrics.incr(
                "grouping.similarity.did_call_seer",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"call_made": False, "blocker": "hybrid-fingerprint"},
            )
            return True

    # Fully customized fingerprint (from either us or the user)
    fingerprint_variant = primary_hashes.variants.get(
        "custom-fingerprint"
    ) or primary_hashes.variants.get("built-in-fingerprint")

    if fingerprint_variant:
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": False, "blocker": fingerprint_variant.type},
        )
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
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": False, "blocker": "global-rate-limit"},
        )

        return True

    if ratelimiter.backend.is_limited(
        f"seer:similarity:project-{project.id}-limit", **per_project_ratelimit
    ):
        logger_extra["limit_per_sec"] = project_limit_per_sec
        logger.warning("should_call_seer_for_grouping.project_ratelimit_hit", extra=logger_extra)

        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": False, "blocker": "project-rate-limit"},
        )

        return True

    return False


def _circuit_breaker_broken(event: Event, project: Project) -> bool:
    breaker_config = options.get("seer.similarity.circuit-breaker-config")
    circuit_breaker = CircuitBreaker(settings.SEER_SIMILARITY_CIRCUIT_BREAKER_KEY, breaker_config)
    circuit_broken = not circuit_breaker.should_allow_request()

    if circuit_broken:
        logger.warning(
            "should_call_seer_for_grouping.broken_circuit_breaker",
            extra={
                "event_id": event.event_id,
                "project_id": project.id,
                **breaker_config,
            },
        )
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": False, "blocker": "circuit-breaker"},
        )

    return circuit_broken


def get_seer_similar_issues(
    event: Event,
    primary_hashes: CalculatedHashes,
    num_neighbors: int = 1,
) -> tuple[dict[str, Any], GroupHash | None]:
    """
    Ask Seer for the given event's nearest neighbor(s) and return the seer response data, sorted
    with the best matches first, along with a grouphash linked to the group Seer decided the event
    should go in (if any), or None if no neighbor was near enough.
    """

    event_hash = primary_hashes.hashes[0]
    stacktrace_string = get_stacktrace_string(
        get_grouping_info_from_variants(primary_hashes.variants)
    )
    exception_type = get_path(event.data, "exception", "values", -1, "type")

    request_data: SimilarIssuesEmbeddingsRequest = {
        "event_id": event.event_id,
        "hash": event_hash,
        "project_id": event.project.id,
        "stacktrace": stacktrace_string,
        "message": filter_null_from_string(event.title),
        "exception_type": filter_null_from_string(exception_type) if exception_type else None,
        "k": num_neighbors,
        "referrer": "ingest",
        "use_reranking": options.get("seer.similarity.ingest.use_reranking"),
    }

    # Similar issues are returned with the closest match first
    seer_results = get_similarity_data_from_seer(request_data)
    seer_results_json = [asdict(result) for result in seer_results]
    similar_issues_metadata = {
        "results": seer_results_json,
        "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
    }
    parent_grouphash = (
        GroupHash.objects.filter(
            hash=seer_results[0].parent_hash, project_id=event.project.id
        ).first()
        if seer_results
        else None
    )

    logger.info(
        "get_seer_similar_issues.results",
        extra={
            "event_id": event.event_id,
            "project_id": event.project.id,
            "hash": event_hash,
            "results": seer_results_json,
            "grouphash_returned": bool(parent_grouphash),
        },
    )

    return (similar_issues_metadata, parent_grouphash)


def maybe_check_seer_for_matching_grouphash(
    event: Event, primary_hashes: CalculatedHashes
) -> GroupHash | None:
    seer_matched_grouphash = None

    if should_call_seer_for_grouping(event, primary_hashes):
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": True, "blocker": "none"},
        )
        try:
            # If no matching group is found in Seer, we'll still get back result
            # metadata, but `seer_matched_grouphash` will be None
            seer_response_data, seer_matched_grouphash = get_seer_similar_issues(
                event, primary_hashes
            )
            event.data["seer_similarity"] = seer_response_data

        # Insurance - in theory we shouldn't ever land here
        except Exception as e:
            sentry_sdk.capture_exception(
                e, tags={"event": event.event_id, "project": event.project.id}
            )

    return seer_matched_grouphash

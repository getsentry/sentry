import logging
from dataclasses import asdict
from typing import Any

import sentry_sdk
from django.conf import settings
from django.utils import timezone

from sentry import options
from sentry import ratelimits as ratelimiter
from sentry.grouping.grouping_info import get_grouping_info_from_variants_legacy
from sentry.grouping.ingest.grouphash_metadata import (
    check_grouphashes_for_positive_fingerprint_match,
)
from sentry.grouping.utils import get_fingerprint_type
from sentry.grouping.variants import BaseVariant
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.seer.similarity.config import (
    get_grouping_model_version,
    should_send_new_model_embeddings,
)
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import SimilarIssuesEmbeddingsRequest
from sentry.seer.similarity.utils import (
    SEER_INELIGIBLE_EVENT_PLATFORMS,
    ReferrerOptions,
    event_content_has_stacktrace,
    filter_null_from_string,
    get_stacktrace_string,
    killswitch_enabled,
    record_did_call_seer_metric,
    stacktrace_exceeds_limits,
)
from sentry.services.eventstore.models import Event
from sentry.utils import metrics
from sentry.utils.circuit_breaker2 import CircuitBreaker
from sentry.utils.safe import get_path

logger = logging.getLogger("sentry.events.grouping")


@sentry_sdk.tracing.trace
def should_call_seer_for_grouping(
    event: Event, variants: dict[str, BaseVariant], event_grouphash: GroupHash
) -> bool:
    """
    Use event content, feature flags, rate limits, killswitches, seer health, etc. to determine
    whether a call to Seer should be made.
    """

    project = event.project

    # Check both of these before returning based on either so we can always gather metrics on the
    # results of both
    content_is_eligible = _event_content_is_seer_eligible(event)
    seer_enabled_for_project = _project_has_similarity_grouping_enabled(project)
    if not (content_is_eligible and seer_enabled_for_project):
        return False

    if (
        _has_custom_fingerprint(event, variants)
        or _is_race_condition_skipped_event(event, event_grouphash)
        or killswitch_enabled(project.id, ReferrerOptions.INGEST, event)
        or _circuit_breaker_broken(event, project)
        # The rate limit check has to be last (see below) but rate-limiting aside, call this after other checks
        # because it calculates the stacktrace string, which we only want to spend the time to do if we already
        # know the other checks have passed.
        or _has_empty_stacktrace_string(event, variants)
        # do this after the empty stacktrace string check because it calculates the stacktrace string
        or _stacktrace_exceeds_limits(event, variants)
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


def _is_race_condition_skipped_event(event: Event, event_grouphash: GroupHash) -> bool:
    """
    In cases where multiple events with the same new hash are racing to assign that hash to a group,
    we only want one of them to be sent to Seer.

    We detect the race when creating `GroupHashMetadata` records, and track all but the winner of
    the race as events whose Seer call we should skip.
    """
    if event.should_skip_seer:
        logger.info(
            "should_call_seer_for_grouping.race_condition_skip",
            extra={
                "grouphash_id": event_grouphash.id,
                "grouphash_has_group": bool(event_grouphash.group_id),
                "hash": event_grouphash.hash,
                "event_id": event.event_id,
            },
        )
        record_did_call_seer_metric(event, call_made=False, blocker="race_condition")
        return True

    # TODO: Temporary debugging for the fact that we're still sometimes seeing multiple events per
    # hash being let through
    initial_has_group = bool(event_grouphash.group_id)  # Should in theory always be False
    if not initial_has_group:
        new_has_group: Any = None  # mypy appeasement
        try:
            event_grouphash.refresh_from_db()
            new_has_group = bool(event_grouphash.group_id)
        except Exception as e:
            new_has_group = repr(e)

    logger.info(
        "should_call_seer_for_grouping.race_condition_pass",
        extra={
            "grouphash_id": event_grouphash.id,
            "initial_grouphash_has_group": initial_has_group,
            "grouphash_has_group": new_has_group,
            "hash": event_grouphash.hash,
            "event_id": event.event_id,
        },
    )
    return False


def _event_content_is_seer_eligible(event: Event) -> bool:
    """
    Determine if an event's contents makes it fit for using with Seer's similar issues model.
    """
    platform = event.platform

    if not event_content_has_stacktrace(event):
        metrics.incr(
            "grouping.similarity.event_content_seer_eligible",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"platform": platform, "eligible": False, "blocker": "no-stacktrace"},
        )
        return False

    if event.platform in SEER_INELIGIBLE_EVENT_PLATFORMS:
        metrics.incr(
            "grouping.similarity.event_content_seer_eligible",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"platform": platform, "eligible": False, "blocker": "unsupported-platform"},
        )
        return False

    metrics.incr(
        "grouping.similarity.event_content_seer_eligible",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={"platform": platform, "eligible": True, "blocker": "none"},
    )
    return True


def _stacktrace_exceeds_limits(event: Event, variants: dict[str, BaseVariant]) -> bool:
    if stacktrace_exceeds_limits(event, variants, ReferrerOptions.INGEST):
        record_did_call_seer_metric(event, call_made=False, blocker="stacktrace-too-long")
        return True

    return False


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


def _has_custom_fingerprint(event: Event, variants: dict[str, BaseVariant]) -> bool:
    fingerprint_variant = variants.get("custom_fingerprint") or variants.get("built_in_fingerprint")

    if fingerprint_variant:
        record_did_call_seer_metric(event, call_made=False, blocker=fingerprint_variant.type)
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
        record_did_call_seer_metric(event, call_made=False, blocker="global-rate-limit")

        return True

    if ratelimiter.backend.is_limited(
        f"seer:similarity:project-{project.id}-limit", **per_project_ratelimit
    ):
        logger_extra["limit_per_sec"] = project_limit_per_sec
        logger.warning("should_call_seer_for_grouping.project_ratelimit_hit", extra=logger_extra)
        record_did_call_seer_metric(event, call_made=False, blocker="project-rate-limit")

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
        record_did_call_seer_metric(event, call_made=False, blocker="circuit-breaker")

    return circuit_broken


def _has_empty_stacktrace_string(event: Event, variants: dict[str, BaseVariant]) -> bool:
    stacktrace_string = get_stacktrace_string(get_grouping_info_from_variants_legacy(variants))
    if not stacktrace_string:
        if stacktrace_string == "":
            record_did_call_seer_metric(event, call_made=False, blocker="empty-stacktrace-string")
        return True
    # Store the stacktrace string in the event so we only calculate it once. We need to pop it
    # later so it isn't stored in the database.
    event.data["stacktrace_string"] = stacktrace_string
    return False


@sentry_sdk.tracing.trace
def get_seer_similar_issues(
    event: Event,
    event_grouphash: GroupHash,
    variants: dict[str, BaseVariant],
    training_mode: bool = False,
) -> tuple[float | None, GroupHash | None]:
    """
    Ask Seer for the given event's nearest neighbor(s) and return the stacktrace distance and
    matching GroupHash of the closest match (if any), or `(None, None)` if no match found.

    Args:
        event: The event being grouped
        event_grouphash: The grouphash for this event
        variants: Grouping variants for the event
        training_mode: If True, only possibly insert embedding without returning matches
    """
    event_hash = event.get_primary_hash()
    exception_type = get_path(event.data, "exception", "values", -1, "type")
    event_fingerprint = event.data.get("fingerprint")
    event_has_hybrid_fingerprint = get_fingerprint_type(event_fingerprint) == "hybrid"

    stacktrace_string = event.data.get(
        "stacktrace_string",
        get_stacktrace_string(get_grouping_info_from_variants_legacy(variants)),
    )

    model_version = get_grouping_model_version(event.project)

    request_data: SimilarIssuesEmbeddingsRequest = {
        "event_id": event.event_id,
        "hash": event_hash,
        "project_id": event.project.id,
        "stacktrace": stacktrace_string,
        "exception_type": filter_null_from_string(exception_type) if exception_type else None,
        "k": options.get("seer.similarity.ingest.num_matches_to_request"),
        "referrer": "ingest",
        "use_reranking": options.get("seer.similarity.ingest.use_reranking"),
        "model": model_version,
        "training_mode": training_mode,
    }
    event.data.pop("stacktrace_string", None)

    seer_request_metric_tags: dict[str, str | int | bool] = {
        "platform": event.platform or "unknown",
        "model_version": model_version.value,
        "training_mode": training_mode,
    }

    seer_results = get_similarity_data_from_seer(
        request_data,
        {**seer_request_metric_tags, "hybrid_fingerprint": event_has_hybrid_fingerprint},
    )

    # All of these will get overridden if we find a usable match
    matching_seer_result = None  # JSON of result data
    winning_parent_grouphash = None  # A GroupHash object
    stacktrace_distance = None
    seer_match_status = "no_matches_usable" if seer_results else "no_seer_matches"

    parent_grouphashes = GroupHash.objects.filter(
        hash__in=[result.parent_hash for result in seer_results],
        project_id=event.project.id,
    )
    parent_grouphashes_by_hash = {grouphash.hash: grouphash for grouphash in parent_grouphashes}

    parent_grouphashes_checked = 0

    if parent_grouphashes:
        # Search for a Seer match we can use. If there are no hybrid fingerprints involved, this
        # will be the first match returned. If hybrid fingerprints *are* involved, this will be the
        # first match returned whose fingerprint values match the incoming event.
        #
        # Similar issues are returned sorted in descending order of similarity, so we want to use
        # the first match we find.
        for seer_result in seer_results:
            parent_grouphash = parent_grouphashes_by_hash[seer_result.parent_hash]
            can_use_parent_grouphash = _should_use_seer_match_for_grouping(
                event,
                event_grouphash,
                parent_grouphash,
                event_has_hybrid_fingerprint,
                parent_grouphashes_checked,
            )
            parent_grouphashes_checked += 1

            if can_use_parent_grouphash:
                winning_parent_grouphash = parent_grouphash
                matching_seer_result = asdict(seer_result)
                stacktrace_distance = seer_result.stacktrace_distance
                seer_match_status = "match_found"
                break

    # If Seer sent back matches, that means it didn't store the incoming event's data in its
    # database. But if we then weren't able to use any of the matches Seer sent back, we do actually
    # want a Seer record to be created, so that future events with this fingerprint have something
    # with which to match.
    if seer_match_status == "no_matches_usable" and options.get(
        "seer.similarity.ingest.store_hybrid_fingerprint_non_matches"
    ):
        request_data = {
            **request_data,
            "referrer": "ingest_follow_up",
            # By asking Seer to find zero matches, we can trick it into thinking there aren't
            # any, thereby forcing it to create the record
            "k": 0,
            # Turn off re-ranking to speed up the process of finding nothing
            "use_reranking": False,
        }

        # TODO: Temporary log to prove things are working as they should. This should come in a pair
        # with the `get_similarity_data_from_seer.ingest_follow_up` log in `similar_issues.py`,
        # which should show that no matches are returned.
        logger.info("get_seer_similar_issues.follow_up_seer_request", extra={"hash": event_hash})

        # We only want this for the side effect, and we know it'll return no matches, so we don't
        # bother to capture the return value.
        get_similarity_data_from_seer(request_data, seer_request_metric_tags)

    is_hybrid_fingerprint_case = (
        event_has_hybrid_fingerprint
        # This means we had to reject at least one match because it was a hybrid even though the
        # event isn't
        or parent_grouphashes_checked > 1
        # This catches cases where we only checked one parent (presumably because there was only one
        # to check) but we couldn't use it because it was hybrid
        or seer_match_status == "no_matches_usable"
    )
    metrics_tags = {"platform": event.platform, "result": seer_match_status}

    # We don't want to collect this metric in non-hybrid cases (for which the answer will always be
    # 1) or in cases where Seer doesn't return any results (for which the answer will always be 0).
    if is_hybrid_fingerprint_case and parent_grouphashes_checked > 0:
        metrics.distribution(
            "grouping.similarity.hybrid_fingerprint_results_checked",
            parent_grouphashes_checked,
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags=metrics_tags,
        )

    metrics.distribution(
        "grouping.similarity.seer_results_returned",
        len(seer_results),
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={
            **metrics_tags,
            "is_hybrid": is_hybrid_fingerprint_case,
            "training_mode": training_mode,
        },
    )
    metrics.incr(
        "grouping.similarity.get_seer_similar_issues",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={
            **metrics_tags,
            "is_hybrid": is_hybrid_fingerprint_case,
            "training_mode": training_mode,
        },
    )

    logger.info(
        "get_seer_similar_issues.results",
        extra={
            "event_id": event.event_id,
            "project_id": event.project.id,
            "hash": event_hash,
            "num_seer_matches": len(seer_results),
            "num_seer_matches_checked": parent_grouphashes_checked,
            "matching_result": matching_seer_result,
            "grouphash_returned": bool(winning_parent_grouphash),
        },
    )

    return (stacktrace_distance, winning_parent_grouphash)


def _should_use_seer_match_for_grouping(
    event: Event,
    event_grouphash: GroupHash,
    parent_grouphash: GroupHash,
    event_has_hybrid_fingerprint: bool,
    num_grouphashes_previously_checked: int,
) -> bool:
    """
    Determine if a match returned from Seer can be used to group the given event.

    If neither the event nor the Seer match has a hybrid fingerprint, return True. Seer matches
    without the necessary metadata to make a determination are considered non-hybrid.

    If the event is hybrid and the match is not (or vice versa), return False.

    If they are both hybrid, return True if their fingerprints match, and False otherwise.
    """
    parent_has_hybrid_fingerprint = (
        get_fingerprint_type(parent_grouphash.get_associated_fingerprint()) == "hybrid"
    )

    if not event_has_hybrid_fingerprint and not parent_has_hybrid_fingerprint:
        # If this isn't the first result we're checking, and the incoming event doesn't have a
        # hybrid fingerprint, we must have already hit a hybrid fingerprint parent and rejected it,
        # so we want to collect this hybrid-fingerprint-related metric
        if num_grouphashes_previously_checked > 0:
            metrics.incr(
                "grouping.similarity.hybrid_fingerprint_match_check",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={"platform": event.platform, "result": "non-hybrid"},
            )

        return True

    # This check will catch both fingerprint type match and fingerprint value match
    fingerprints_match = check_grouphashes_for_positive_fingerprint_match(
        event_grouphash, parent_grouphash
    )
    parent_has_metadata = bool(
        parent_grouphash.metadata and parent_grouphash.metadata.hashing_metadata
    )

    if not parent_has_metadata:
        result = "no_parent_metadata"
    elif event_has_hybrid_fingerprint and not parent_has_hybrid_fingerprint:
        result = "only_event_hybrid"
    elif parent_has_hybrid_fingerprint and not event_has_hybrid_fingerprint:
        result = "only_parent_hybrid"
    elif not fingerprints_match:
        result = "no_fingerprint_match"
    else:
        result = "fingerprint_match"

    metrics.incr(
        "grouping.similarity.hybrid_fingerprint_match_check",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={"platform": event.platform, "result": result},
    )

    return fingerprints_match


@sentry_sdk.tracing.trace
def maybe_check_seer_for_matching_grouphash(
    event: Event,
    event_grouphash: GroupHash,
    variants: dict[str, BaseVariant],
    all_grouphashes: list[GroupHash],
) -> GroupHash | None:
    seer_matched_grouphash = None

    if should_call_seer_for_grouping(event, variants, event_grouphash):
        record_did_call_seer_metric(event, call_made=True, blocker="none")

        try:
            # If no matching group is found in Seer, these will both be None
            seer_match_distance, seer_matched_grouphash = get_seer_similar_issues(
                event, event_grouphash, variants
            )
        except Exception as e:  # Insurance - in theory we shouldn't ever land here
            sentry_sdk.capture_exception(
                e, tags={"event": event.event_id, "project": event.project.id}
            )
            return None

        # Update the relevant GroupHash with Seer results
        gh_metadata = event_grouphash.metadata
        if gh_metadata:

            # TODO: This should never be true (anything created with `objects.create` should have an
            # id), but it seems in some cases to happen anyway. While we debug the problem, to avoid
            # errors, bail early.
            metadata_id: Any = (
                gh_metadata.id
            )  # Even mypy knows this should never happen, hence the need for the Any
            if metadata_id is None:
                logger.info(
                    "grouphash_metadata.none_id",
                    extra={
                        "grouphash_id": event_grouphash.id,
                        "grouphash_has_group": bool(event_grouphash.group_id),
                        "hash": event_grouphash.hash,
                        "event_id": event.event_id,
                        "project_slug": event.project.slug,
                        "project_id": event.project.id,
                        "org_id": event.organization.id,
                    },
                )
                return seer_matched_grouphash

            timestamp = timezone.now()

            model_version = get_grouping_model_version(event.project)

            gh_metadata.update(
                # Technically the time of the metadata record creation and the time of the Seer
                # request will be some milliseconds apart, but a) the difference isn't meaningful
                # for us, and b) forcing them to be the same (rather than just close) lets us use
                # their equality as a signal that the Seer call happened during ingest rather than
                # during a backfill, without having to store that information separately.
                #
                # In rare race condition cases, `date_added` will be None (if different events win
                # the race to create the relevant `GroupHash` and `GroupHashMetadata` records), so
                # we set that if necessary here as well.
                date_added=gh_metadata.date_added or timestamp,
                seer_date_sent=gh_metadata.date_added or timestamp,
                seer_event_sent=event.event_id,
                seer_model=model_version.value,
                seer_matched_grouphash=seer_matched_grouphash,
                seer_match_distance=seer_match_distance,
            )

    return seer_matched_grouphash


@sentry_sdk.tracing.trace
def maybe_send_seer_for_new_model_training(
    event: Event,
    existing_grouphash: GroupHash,
    variants: dict[str, BaseVariant],
) -> None:
    """
    Send a training_mode=true request to Seer to build embeddings for the new model
    version if the existing grouphash hasn't been sent to the new version yet.

    This only happens for projects that have the new model rolled out. It helps
    build embeddings for existing groups without affecting production grouping decisions.

    Args:
        event: The event being grouped
        existing_grouphash: The grouphash that was found for this event
        variants: Grouping variants for the event
    """

    # Check if we should send embeddings for the new model
    gh_metadata = existing_grouphash.metadata
    grouphash_seer_model = gh_metadata.seer_model if gh_metadata else None

    if not should_send_new_model_embeddings(event.project, grouphash_seer_model):
        return

    # Send training mode request (honor all checks like rate limits, circuit breaker, etc.)
    if not should_call_seer_for_grouping(event, variants, existing_grouphash):
        return

    record_did_call_seer_metric(event, call_made=True, blocker="none", training_mode=True)

    try:
        # Call Seer with training_mode=True (results won't be used for grouping)
        get_seer_similar_issues(event, existing_grouphash, variants, training_mode=True)
    except Exception as e:
        sentry_sdk.capture_exception(
            e,
            tags={
                "event": event.event_id,
                "project": event.project.id,
                "grouphash": existing_grouphash.hash,
            },
        )

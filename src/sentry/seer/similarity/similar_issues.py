import logging

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry import options
from sentry.conf.server import (
    SEER_MAX_GROUPING_DISTANCE,
    SEER_SIMILAR_ISSUES_URL,
    SEER_SIMILARITY_CIRCUIT_BREAKER_KEY,
)
from sentry.models.grouphash import GroupHash
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.seer.similarity.types import (
    IncompleteSeerDataError,
    SeerSimilarIssueData,
    SimilarGroupNotFoundError,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.tasks.delete_seer_grouping_records import delete_seer_grouping_records_by_hash
from sentry.utils import json, metrics
from sentry.utils.circuit_breaker2 import CircuitBreaker
from sentry.utils.json import JSONDecodeError, apply_key_filter

logger = logging.getLogger(__name__)


seer_grouping_connection_pool = connection_from_url(
    settings.SEER_GROUPING_URL,
    timeout=settings.SEER_GROUPING_TIMEOUT,
)


def get_similarity_data_from_seer(
    similar_issues_request: SimilarIssuesEmbeddingsRequest,
) -> list[SeerSimilarIssueData]:
    """
    Request similar issues data from seer and normalize the results. Returns similar groups
    sorted in order of descending similarity.
    """
    project_id = similar_issues_request["project_id"]
    request_hash = similar_issues_request["hash"]
    referrer = similar_issues_request.get("referrer")
    metric_tags: dict[str, str | int] = {"referrer": referrer} if referrer else {}

    logger_extra = apply_key_filter(
        similar_issues_request,
        keep_keys=["event_id", "project_id", "message", "hash", "referrer", "use_reranking"],
    )
    # We have to rename the key `message` because it conflicts with the `LogRecord` attribute of the
    # same name
    logger_extra["message_value"] = logger_extra.pop("message", None)
    logger.info(
        "get_seer_similar_issues.request",
        extra=logger_extra,
    )
    # TODO: This is temporary, to debug Seer being called on existing hashes during ingest
    if similar_issues_request.get("referrer") == "ingest":
        existing_grouphash = GroupHash.objects.filter(
            hash=request_hash, project_id=project_id
        ).first()
        if existing_grouphash and existing_grouphash.group_id:
            logger.warning(
                "get_seer_similar_issues.hash_exists",
                extra={
                    "event_id": similar_issues_request["event_id"],
                    "project_id": project_id,
                    "hash": request_hash,
                    "grouphash_id": existing_grouphash.id,
                    "group_id": existing_grouphash.group_id,
                    "referrer": similar_issues_request.get("referrer"),
                },
            )
    # TODO: This is temporary, to debug Seer being sent empty stacktraces (which will happen for
    # ingest requests if the filter in `event_content_is_seer_eligible` for existence of frames
    # isn't enough, or if the similar issues tab ever sends an empty stacktrace). If we want this
    # check to become permanent, we should move it elsewhere.
    if not similar_issues_request["stacktrace"]:
        logger.warning(
            "get_seer_similar_issues.empty_stacktrace",
            extra={
                "event_id": similar_issues_request["event_id"],
                "project_id": project_id,
                "hash": request_hash,
                "referrer": similar_issues_request.get("referrer"),
            },
        )
        metrics.incr(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={
                **metric_tags,
                "outcome": "empty_stacktrace",
            },
        )
        return []

    circuit_breaker = CircuitBreaker(
        SEER_SIMILARITY_CIRCUIT_BREAKER_KEY,
        options.get("seer.similarity.circuit-breaker-config"),
    )

    try:
        response = make_signed_seer_api_request(
            seer_grouping_connection_pool,
            SEER_SIMILAR_ISSUES_URL,
            json.dumps({"threshold": SEER_MAX_GROUPING_DISTANCE, **similar_issues_request}).encode(
                "utf8"
            ),
        )
    # See `SEER_GROUPING_TIMEOUT` in `sentry.conf.server`
    except (TimeoutError, MaxRetryError) as e:
        logger.warning("get_seer_similar_issues.request_error", extra=logger_extra)
        metrics.incr(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={**metric_tags, "outcome": "error", "error": type(e).__name__},
        )
        circuit_breaker.record_error()
        return []

    metric_tags["response_status"] = response.status

    if response.status > 200:
        redirect = response.get_redirect_location()
        if redirect:
            logger.error(
                f"Encountered redirect when calling Seer endpoint {SEER_SIMILAR_ISSUES_URL}. Please update `SEER_SIMILAR_ISSUES_URL` in `sentry.conf.server` to be '{redirect}'."  # noqa
            )
        else:
            logger.error(
                f"Received {response.status} when calling Seer endpoint {SEER_SIMILAR_ISSUES_URL}.",  # noqa
                extra={"response_data": response.data},
            )

        metrics.incr(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={
                **metric_tags,
                "outcome": "error",
                "error": "Redirect" if redirect else "RequestError",
            },
        )

        if response.status >= 500:
            circuit_breaker.record_error()

        return []

    try:
        response_data = json.loads(response.data.decode("utf-8")).get("responses")
    except (
        AttributeError,  # caused by a response with no data and therefore no `.decode` method
        UnicodeError,
        JSONDecodeError,  # caused by Seer erroring out and sending back the error page HTML
    ) as e:
        logger.exception(
            "Failed to parse seer similar issues response",
            extra={
                "request_params": similar_issues_request,
                "response_data": response.data,
                "response_code": response.status,
            },
        )
        metrics.incr(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={**metric_tags, "outcome": "error", "error": type(e).__name__},
        )
        return []

    if not response_data:
        metrics.incr(
            "seer.similar_issues_request",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={**metric_tags, "outcome": "no_similar_groups"},
        )
        return []

    # This may get overwritten as we process the results, but by this point we know that Seer at
    # least found *something*
    metric_tags["outcome"] = "similar_groups_found"

    normalized_results = []

    for raw_similar_issue_data in response_data:
        try:
            normalized = SeerSimilarIssueData.from_raw(project_id, raw_similar_issue_data)

            if (
                normalized.should_group
                # If an earlier entry in the results list caused an error, we don't want to
                # overwrite that information
                and metric_tags["outcome"] != "error"
            ):
                metric_tags["outcome"] = "matching_group_found"

            normalized_results.append(normalized)
        except IncompleteSeerDataError as err:
            # This will tag the entire request as errored even if not all of the results are
            # incomplete, but that's okay, because even one being incomplete means that Seer is
            # broken in some way
            metric_tags.update({"outcome": "error", "error": "IncompleteSeerDataError"})
            logger.exception(
                str(err),
                extra={
                    "request_params": similar_issues_request,
                    "raw_similar_issue_data": raw_similar_issue_data,
                },
            )
        except SimilarGroupNotFoundError:
            parent_hash = raw_similar_issue_data.get("parent_hash")

            # Tell Seer to delete the hash from its database, so it doesn't keep suggesting a group
            # which doesn't exist
            delete_seer_grouping_records_by_hash.delay(project_id, [parent_hash])

            # As with the `IncompleteSeerDataError` above, this will mark the entire request as
            # errored even if it's only one group that we can't find. The extent to which that's
            # inaccurate will be quite small, though, as the vast majority of calls to this function
            # come from ingest (where we're only requesting one matching group, making "one's
            # missing" the same thing as "they're all missing"). We should also almost never land
            # here in any case, since deleting the group on the Sentry side should already have
            # triggered a request to Seer to delete the corresponding hashes.
            metric_tags.update({"outcome": "error", "error": "SimilarGroupNotFoundError"})
            logger.warning(
                "get_similarity_data_from_seer.parent_group_not_found",
                extra={
                    "hash": request_hash,
                    "parent_hash": parent_hash,
                    "project_id": project_id,
                },
            )

    metrics.incr(
        "seer.similar_issues_request",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags=metric_tags,
    )
    return sorted(
        normalized_results,
        key=lambda issue_data: issue_data.stacktrace_distance,
    )

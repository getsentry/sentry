import logging

from django.conf import settings

from sentry.conf.server import SEER_MAX_GROUPING_DISTANCE, SEER_SIMILAR_ISSUES_URL
from sentry.models.grouphash import GroupHash
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.seer.similarity.types import (
    IncompleteSeerDataError,
    SeerSimilarIssueData,
    SimilarGroupNotFoundError,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError, apply_key_filter

logger = logging.getLogger(__name__)

# TODO: Keeping this at a 100% sample rate for now in order to get good signal as we're rolling out
# and calls are still comparatively rare. Once traffic gets heavy enough, we should probably ramp
# this down.
SIMILARITY_REQUEST_METRIC_SAMPLE_RATE = 1.0


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
    logger.info(
        "get_seer_similar_issues.request",
        extra=apply_key_filter(
            similar_issues_request,
            keep_keys=["event_id", "project_id", "message", "hash", "referrer"],
        ),
    )
    # TODO: This is temporary, to debug Seer being called on existing hashes
    existing_grouphash = GroupHash.objects.filter(
        hash=similar_issues_request["hash"], project_id=similar_issues_request["project_id"]
    ).first()
    if existing_grouphash and existing_grouphash.group_id:
        logger.warning(
            "get_seer_similar_issues.hash_exists",
            extra={
                "event_id": similar_issues_request["event_id"],
                "project_id": similar_issues_request["project_id"],
                "hash": similar_issues_request["hash"],
                "grouphash_id": existing_grouphash.id,
                "group_id": existing_grouphash.group_id,
                "referrer": similar_issues_request.get("referrer"),
            },
        )

    response = make_signed_seer_api_request(
        seer_grouping_connection_pool,
        SEER_SIMILAR_ISSUES_URL,
        json.dumps({"threshold": SEER_MAX_GROUPING_DISTANCE, **similar_issues_request}).encode(
            "utf8"
        ),
    )

    metric_tags: dict[str, str | int] = {"response_status": response.status}

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
            sample_rate=SIMILARITY_REQUEST_METRIC_SAMPLE_RATE,
            tags={
                **metric_tags,
                "outcome": "error",
                "error": "Redirect" if redirect else "RequestError",
            },
        )

        return []

    try:
        response_data = json.loads(response.data.decode("utf-8")).get("responses")
    except (
        AttributeError,  # caused by a response with no data and therefore no `.decode` method
        UnicodeError,
        JSONDecodeError,
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
            sample_rate=SIMILARITY_REQUEST_METRIC_SAMPLE_RATE,
            tags={**metric_tags, "outcome": "error", "error": type(e).__name__},
        )
        return []

    if not response_data:
        metrics.incr(
            "seer.similar_issues_request",
            sample_rate=SIMILARITY_REQUEST_METRIC_SAMPLE_RATE,
            tags={**metric_tags, "outcome": "no_similar_groups"},
        )
        return []

    # This may get overwritten as we process the results, but by this point we know that Seer at
    # least found *something*
    metric_tags["outcome"] = "similar_groups_found"

    normalized_results = []

    for raw_similar_issue_data in response_data:
        try:
            normalized = SeerSimilarIssueData.from_raw(
                similar_issues_request["project_id"], raw_similar_issue_data
            )

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
            # This will similarly mark the entire request as errored even if it's only one group
            # that we can't find, but again, we're okay with that because a group being missing
            # implies there's something wrong with our deletion logic, which is a problem to which
            # we want to pay attention.
            metric_tags.update({"outcome": "error", "error": "SimilarGroupNotFoundError"})
            logger.warning(
                "get_similarity_data_from_seer.parent_group_not_found",
                extra={
                    "hash": similar_issues_request["hash"],
                    "parent_hash": raw_similar_issue_data.get("parent_hash"),
                    "project_id": similar_issues_request["project_id"],
                },
            )

    metrics.incr(
        "seer.similar_issues_request",
        sample_rate=SIMILARITY_REQUEST_METRIC_SAMPLE_RATE,
        tags=metric_tags,
    )
    return sorted(
        normalized_results,
        key=lambda issue_data: issue_data.stacktrace_distance,
    )

from typing import NotRequired, TypedDict

import orjson
from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool, Retry

from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import SeerViewerContext, make_signed_seer_api_request

# Shared connection pool for feedback AI usecases. Requests can override the default timeout and retries.
seer_summarization_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
    retries=0,
    maxsize=10,  # Max persisted connections. If the number of concurrent requests exceeds this, temporary connections are created.
)

# Connection pool for the shadow spam classifier, which runs on its own Seer deployment.
# Created lazily since SEER_FEEDBACK_SPAM_URL is unset by default.
_seer_feedback_spam_connection_pool: HTTPConnectionPool | None = None


def _get_seer_feedback_spam_connection_pool() -> HTTPConnectionPool:
    global _seer_feedback_spam_connection_pool
    if _seer_feedback_spam_connection_pool is None:
        if not settings.SEER_FEEDBACK_SPAM_URL:
            raise ValueError("SEER_FEEDBACK_SPAM_URL is not configured")
        _seer_feedback_spam_connection_pool = connection_from_url(
            settings.SEER_FEEDBACK_SPAM_URL,
            timeout=settings.SEER_DEFAULT_TIMEOUT,
            retries=0,
            maxsize=10,
        )
    return _seer_feedback_spam_connection_pool


class SpamShadowScoreRequest(TypedDict):
    organization_id: int
    project_id: int
    feedback_event_id: str
    feedback_message: str
    llm_is_spam: bool
    log_mismatch_message: NotRequired[bool]


class SpamDetectionRequest(TypedDict):
    organization_id: int
    feedback_message: str


class LabelGenerationRequest(TypedDict):
    organization_id: int
    feedback_message: str


class GenerateFeedbackTitleRequest(TypedDict):
    organization_id: int
    feedback_message: str


class LabelGroupFeedbacksContext(TypedDict):
    feedback: str
    labels: list[str]


class LabelGroupsRequest(TypedDict):
    labels: list[str]
    feedbacks_context: list[LabelGroupFeedbacksContext]


class SummarizeFeedbacksRequest(TypedDict):
    feedbacks: list[str]


def make_spam_detection_request(
    body: SpamDetectionRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/spam-detection",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
        viewer_context=viewer_context,
    )


def make_label_generation_request(
    body: LabelGenerationRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/labels",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
        viewer_context=viewer_context,
    )


def make_title_generation_request(
    body: GenerateFeedbackTitleRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/title",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
        viewer_context=viewer_context,
    )


def make_label_groups_request(
    body: LabelGroupsRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/label-groups",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
        viewer_context=viewer_context,
    )


def make_summarize_feedbacks_request(
    body: SummarizeFeedbacksRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/summarize",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
        viewer_context=viewer_context,
    )


def make_spam_shadow_score_request(
    body: SpamShadowScoreRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        _get_seer_feedback_spam_connection_pool(),
        "/v0/feedback/spam-score",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
        viewer_context=viewer_context,
    )

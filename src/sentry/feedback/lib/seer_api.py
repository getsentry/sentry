from typing import TypedDict

import orjson
from django.conf import settings
from urllib3 import BaseHTTPResponse, Retry

from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request

# Shared connection pool for feedback AI usecases. No timeout or retries by default, but requests can override these params.
seer_summarization_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
    timeout=None,
    retries=0,
    maxsize=10,  # Max persisted connections. If the number of concurrent requests exceeds this, temporary connections are created.
)


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
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/spam-detection",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )


def make_label_generation_request(
    body: LabelGenerationRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/labels",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )


def make_title_generation_request(
    body: GenerateFeedbackTitleRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/title",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )


def make_label_groups_request(
    body: LabelGroupsRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/label-groups",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )


def make_summarize_feedbacks_request(
    body: SummarizeFeedbacksRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/feedback/summarize",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )

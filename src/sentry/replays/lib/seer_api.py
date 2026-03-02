from typing import NotRequired, TypedDict

import orjson
from django.conf import settings
from urllib3 import BaseHTTPResponse, Retry

from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request

# Shared connection pool for replay AI usecases. No timeout or retries by default, but requests can override these params.
seer_summarization_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
    timeout=None,
    retries=0,
    maxsize=20,  # Max persisted connections. If the number of concurrent requests exceeds this, temporary connections are created.
)


class ReplaySummaryStartRequest(TypedDict):
    replay_id: str
    replay_start: str | None
    replay_end: str | None
    num_segments: int
    organization_id: int
    project_id: int
    temperature: NotRequired[float | None]


class ReplaySummaryStateRequest(TypedDict):
    replay_id: str
    organization_id: int
    project_id: int


class ReplayDeleteSeerDataRequest(TypedDict):
    replay_ids: list[str]
    organization_id: int
    project_id: int


def make_replay_summary_start_request(
    body: ReplaySummaryStartRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/replay/breadcrumbs/start",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )


def make_replay_summary_state_request(
    body: ReplaySummaryStateRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/replay/breadcrumbs/state",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )


def make_replay_delete_request(
    body: ReplayDeleteSeerDataRequest,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_connection_pool,
        "/v1/automation/summarize/replay/breadcrumbs/delete",
        body=orjson.dumps(body),
        timeout=timeout,
        retries=retries,
    )

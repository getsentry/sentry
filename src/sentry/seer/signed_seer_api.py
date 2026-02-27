import hashlib
import hmac
import logging
from typing import Any, NotRequired, TypedDict
from urllib.parse import urlparse

import orjson
import sentry_sdk
from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool, Retry

from sentry.net.http import connection_from_url
from sentry.utils import metrics

logger = logging.getLogger(__name__)


seer_summarization_default_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
)

seer_autofix_default_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL,
)

seer_anomaly_detection_default_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
)


@sentry_sdk.tracing.trace
def make_signed_seer_api_request(
    connection_pool: HTTPConnectionPool,
    path: str,
    body: bytes,
    timeout: int | float | None = None,
    retries: int | None | Retry = None,
    metric_tags: dict[str, Any] | None = None,
    method: str = "POST",
) -> BaseHTTPResponse:
    host = connection_pool.host
    if connection_pool.port:
        host += ":" + str(connection_pool.port)

    url = f"{connection_pool.scheme}://{host}{path}"
    parsed = urlparse(url)

    auth_headers = sign_with_seer_secret(body)

    options: dict[str, Any] = {}
    if timeout:
        options["timeout"] = timeout
    if retries is not None:
        options["retries"] = retries

    with metrics.timer(
        "seer.request_to_seer",
        sample_rate=1.0,
        tags={"endpoint": parsed.path, **(metric_tags or {})},
    ):
        return connection_pool.urlopen(
            method,
            parsed.path,
            body=body,
            headers={"content-type": "application/json;charset=utf-8", **auth_headers},
            **options,
        )


class OrgProjectKnowledgeProjectData(TypedDict):
    project_id: int
    slug: str
    sdk_name: str
    error_count: int
    transaction_count: int
    instrumentation: list[str]
    top_transactions: list[str]
    top_span_operations: list[tuple[str, str]]


class OrgProjectKnowledgeIndexRequest(TypedDict):
    org_id: int
    projects: list[OrgProjectKnowledgeProjectData]


class RemoveRepositoryRequest(TypedDict):
    organization_id: int
    repo_provider: str
    repo_external_id: str


class ExplorerIndexProject(TypedDict):
    org_id: int
    project_id: int


class ExplorerIndexRequest(TypedDict):
    projects: list[ExplorerIndexProject]


class LlmGenerateRequest(TypedDict):
    provider: str
    model: str
    referrer: str
    prompt: str
    system_prompt: str
    temperature: float
    max_tokens: int
    response_schema: NotRequired[dict[str, Any]]


def make_org_project_knowledge_index_request(
    body: OrgProjectKnowledgeIndexRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/explorer/index/org-project-knowledge",
        body=orjson.dumps(body),
        timeout=timeout,
    )


def make_remove_repository_request(
    body: RemoveRepositoryRequest,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/project-preference/remove-repository",
        body=orjson.dumps(body),
    )


def make_explorer_index_request(
    body: ExplorerIndexRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/explorer/index",
        body=orjson.dumps(body),
        timeout=timeout,
    )


def make_seer_models_request(
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/models",
        body=b"",
        timeout=timeout,
        method="GET",
    )


def make_llm_generate_request(
    body: LlmGenerateRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/llm/generate",
        body=orjson.dumps(body),
        timeout=timeout,
    )


def sign_with_seer_secret(body: bytes) -> dict[str, str]:
    auth_headers: dict[str, str] = {}
    if settings.SEER_API_SHARED_SECRET:
        signature = hmac.new(
            settings.SEER_API_SHARED_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        auth_headers["Authorization"] = f"Rpcsignature rpc0:{signature}"
    else:
        # TODO(jstanley): remove this once the shared secret is confirmed to always be set
        logger.warning(
            "settings.SEER_API_SHARED_SECRET is not set. Unable to add auth headers for call to Seer."
        )
    return auth_headers

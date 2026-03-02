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


class SeerViewerContext(TypedDict, total=False):
    organization_id: int
    user_id: int


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
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    host = connection_pool.host
    if connection_pool.port:
        host += ":" + str(connection_pool.port)

    url = f"{connection_pool.scheme}://{host}{path}"
    parsed = urlparse(url)

    auth_headers = sign_with_seer_secret(body)

    headers: dict[str, str] = {
        "content-type": "application/json;charset=utf-8",
        **auth_headers,
    }

    if viewer_context:
        if settings.SEER_API_SHARED_SECRET:
            context_bytes = orjson.dumps(viewer_context)
            context_signature = sign_viewer_context(context_bytes)
            headers["X-Viewer-Context"] = context_bytes.decode("utf-8")
            headers["X-Viewer-Context-Signature"] = context_signature
        else:
            logger.warning(
                "settings.SEER_API_SHARED_SECRET is not set. Unable to sign viewer context for call to Seer."
            )

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
            headers=headers,
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


class SummarizeTraceRequest(TypedDict):
    trace_id: str
    only_transaction: bool
    trace: dict[str, Any]


class SummarizeIssueRequest(TypedDict):
    group_id: int
    issue: dict[str, Any]
    trace_tree: NotRequired[dict[str, Any] | None]
    organization_slug: str
    organization_id: int
    project_id: int


class SupergroupsEmbeddingRequest(TypedDict):
    organization_id: int
    group_id: int
    artifact_data: dict[str, Any]


class ServiceMapUpdateRequest(TypedDict):
    organization_id: int
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


class UnitTestGenerationRequest(TypedDict):
    repo: dict[str, Any]
    pr_id: int


class SearchAgentStateRequest(TypedDict):
    run_id: int
    organization_id: int


class TranslateQueryRequest(TypedDict):
    org_id: int
    org_slug: str
    project_ids: list[int]
    natural_language_query: str


class SearchAgentStartRequest(TypedDict):
    org_id: int
    org_slug: str
    project_ids: list[int]
    natural_language_query: str
    strategy: str
    user_email: NotRequired[str]
    timezone: NotRequired[str]
    options: NotRequired[dict[str, Any]]


class TranslateAgenticRequest(TypedDict):
    org_id: int
    org_slug: str
    project_ids: list[int]
    natural_language_query: str
    strategy: str
    options: NotRequired[dict[str, Any]]


class CreateCacheRequest(TypedDict):
    org_id: int
    project_ids: list[int]


class CompareDistributionsRequest(TypedDict):
    baseline: list[dict[str, Any]]
    outliers: list[dict[str, Any]]
    total_baseline: int
    total_outliers: int
    config: dict[str, Any]
    meta: dict[str, Any]


def make_summarize_trace_request(
    body: SummarizeTraceRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_default_connection_pool,
        "/v1/automation/summarize/trace",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        timeout=timeout,
    )


def make_summarize_issue_request(
    body: SummarizeIssueRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_default_connection_pool,
        "/v1/automation/summarize/issue",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        timeout=timeout,
    )


def make_supergroups_embedding_request(
    body: SupergroupsEmbeddingRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v0/issues/supergroups",
        body=orjson.dumps(body),
        timeout=timeout,
    )


def make_service_map_update_request(
    body: ServiceMapUpdateRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/explorer/service-map/update",
        body=orjson.dumps(body),
        timeout=timeout,
    )


def make_unit_test_generation_request(
    body: UnitTestGenerationRequest,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/codegen/unit-tests",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
    )


def make_search_agent_state_request(
    body: SearchAgentStateRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/state",
        body=orjson.dumps(body),
        timeout=timeout,
    )


def make_translate_query_request(
    body: TranslateQueryRequest,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/translate",
        body=orjson.dumps(body),
    )


def make_search_agent_start_request(
    body: SearchAgentStartRequest,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/start",
        body=orjson.dumps(body),
        timeout=timeout,
    )


def make_translate_agentic_request(
    body: TranslateAgenticRequest,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/translate-agentic",
        body=orjson.dumps(body),
    )


def make_create_cache_request(
    body: CreateCacheRequest,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/create-cache",
        body=orjson.dumps(body),
    )


def make_compare_distributions_request(
    body: CompareDistributionsRequest,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_anomaly_detection_default_connection_pool,
        "/v1/workflows/compare/cohort",
        body=orjson.dumps(body),
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


def sign_viewer_context(context_bytes: bytes) -> str:
    """Sign the viewer context payload with the shared secret."""
    return hmac.new(
        settings.SEER_API_SHARED_SECRET.encode("utf-8"),
        context_bytes,
        hashlib.sha256,
    ).hexdigest()

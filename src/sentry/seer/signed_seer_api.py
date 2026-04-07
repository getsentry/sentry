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
from sentry.viewer_context import ViewerContext, get_viewer_context


class SeerViewerContext(TypedDict, total=False):
    organization_id: int
    # TODO(jeremy.stanley): user_id is int | None as a temporary state while
    # consolidating viewer context across call sites. Some pass request.user.id
    # (which can be None for anonymous users), others omit the key entirely.
    # Once all call sites are wired up, tighten this to int and ensure callers
    # only set user_id when an authenticated user is present.
    user_id: int | None


logger = logging.getLogger(__name__)


seer_summarization_default_connection_pool = connection_from_url(
    settings.SEER_SUMMARIZATION_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
)

seer_autofix_default_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
)

seer_anomaly_detection_default_connection_pool = connection_from_url(
    settings.SEER_ANOMALY_DETECTION_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
)

seer_grouping_default_connection_pool = connection_from_url(
    settings.SEER_GROUPING_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
)


def _resolve_viewer_context(
    explicit: SeerViewerContext | None = None,
) -> ViewerContext | None:
    """Merge explicit SeerViewerContext with the contextvar.

    Converts the legacy SeerViewerContext into a ViewerContext, then merges
    with the contextvar. Explicit non-None fields win. On disagreement,
    logs a warning and strips the token for safety.
    """
    vc = get_viewer_context()

    if explicit is None and vc is None:
        return None
    if explicit is None:
        return vc

    explicit_vc = ViewerContext(
        organization_id=explicit.get("organization_id"),
        user_id=explicit.get("user_id"),
    )

    if vc is None:
        return explicit_vc

    has_mismatch = False
    org_id = vc.organization_id
    user_id = vc.user_id

    if explicit_vc.organization_id is not None:
        if org_id is not None and org_id != explicit_vc.organization_id:
            logger.warning(
                "seer.viewer_context_mismatch",
                extra={
                    "field": "organization_id",
                    "contextvar": org_id,
                    "explicit": explicit_vc.organization_id,
                },
            )
            has_mismatch = True
        org_id = explicit_vc.organization_id

    if explicit_vc.user_id is not None:
        if user_id is not None and user_id != explicit_vc.user_id:
            logger.warning(
                "seer.viewer_context_mismatch",
                extra={
                    "field": "user_id",
                    "contextvar": user_id,
                    "explicit": explicit_vc.user_id,
                },
            )
            has_mismatch = True
        user_id = explicit_vc.user_id

    return ViewerContext(
        organization_id=org_id,
        user_id=user_id,
        actor_type=vc.actor_type,
        token=None if has_mismatch else vc.token,
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

    resolved = _resolve_viewer_context(viewer_context)
    if resolved:
        if settings.SEER_API_SHARED_SECRET:
            try:
                context_bytes = orjson.dumps(resolved.serialize())
                context_signature = sign_viewer_context(context_bytes)
                headers["X-Viewer-Context"] = context_bytes.decode("utf-8")
                headers["X-Viewer-Context-Signature"] = context_signature
            except Exception:
                logger.exception("Failed to serialize viewer context for call to Seer.")
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


class RepoIdentifier(TypedDict):
    repo_provider: str
    repo_external_id: str


class BulkRemoveRepositoriesRequest(TypedDict):
    organization_id: int
    repositories: list[RepoIdentifier]


class ExplorerIndexProject(TypedDict):
    org_id: int
    project_id: int


class ExplorerIndexRequest(TypedDict):
    projects: list[ExplorerIndexProject]


class ExplorerIndexSentryKnowledgeRequest(TypedDict):
    replace_existing: bool


class LlmGenerateRequest(TypedDict):
    provider: str
    model: str
    referrer: str
    prompt: str
    system_prompt: str
    temperature: float
    max_tokens: int
    response_schema: NotRequired[dict[str, Any]]


class RepoDetails(TypedDict):
    project_ids: list[int]
    provider: str
    owner: str
    name: str
    external_id: str
    languages: list[str]
    integration_id: NotRequired[str | None]


class ExplorerIndexOrgRepoRequest(TypedDict):
    org_id: int
    repos: list[RepoDetails]


def make_org_repo_knowledge_index_request(
    body: ExplorerIndexOrgRepoRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/explorer/index/org-repo-knowledge",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_org_project_knowledge_index_request(
    body: OrgProjectKnowledgeIndexRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/explorer/index/org-project-knowledge",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_index_sentry_knowledge_request(
    body: ExplorerIndexSentryKnowledgeRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/explorer/index/sentry-knowledge",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_remove_repository_request(
    body: RemoveRepositoryRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/project-preference/remove-repository",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_bulk_remove_repositories_request(
    body: BulkRemoveRepositoriesRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/project-preference/bulk-remove-repositories",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_explorer_index_request(
    body: ExplorerIndexRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/explorer/index",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_seer_models_request(
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/models",
        body=b"",
        timeout=timeout,
        method="GET",
        viewer_context=viewer_context,
    )


def make_llm_generate_request(
    body: LlmGenerateRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/llm/generate",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
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
    experiment_variant: NotRequired[str | None]


class SupergroupsEmbeddingRequest(TypedDict):
    organization_id: int
    group_id: int
    project_id: int
    artifact_data: dict[str, Any]


class LightweightRCAClusterRequest(TypedDict):
    group_id: int
    issue: dict[str, Any]
    organization_slug: str
    organization_id: int
    project_id: int


class SupergroupsGetRequest(TypedDict):
    organization_id: int
    supergroup_id: int


class SupergroupsGetByGroupIdsRequest(TypedDict):
    organization_id: int
    group_ids: list[int]


class SupergroupDetailData(TypedDict):
    id: int
    title: str
    summary: str
    error_type: str
    code_area: str
    group_ids: list[int]
    project_ids: list[int]
    created_at: str
    updated_at: str


class SupergroupsByGroupIdsResponse(TypedDict):
    data: list[SupergroupDetailData]


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
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_default_connection_pool,
        "/v1/automation/summarize/trace",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_summarize_issue_request(
    body: SummarizeIssueRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_summarization_default_connection_pool,
        "/v1/automation/summarize/issue",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_supergroups_embedding_request(
    body: SupergroupsEmbeddingRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v0/issues/supergroups",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_lightweight_rca_cluster_request(
    body: LightweightRCAClusterRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v0/issues/supergroups/cluster-lightweight",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_supergroups_get_request(
    body: SupergroupsGetRequest,
    viewer_context: SeerViewerContext,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v0/issues/supergroups/get",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_supergroups_get_by_group_ids_request(
    body: SupergroupsGetByGroupIdsRequest,
    viewer_context: SeerViewerContext,
    timeout: int | float | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v0/issues/supergroups/get-by-group-ids",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_service_map_update_request(
    body: ServiceMapUpdateRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/explorer/service-map/update",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_unit_test_generation_request(
    body: UnitTestGenerationRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/automation/codegen/unit-tests",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_search_agent_state_request(
    body: SearchAgentStateRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/state",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_translate_query_request(
    body: TranslateQueryRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/translate",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_search_agent_start_request(
    body: SearchAgentStartRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/start",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_translate_agentic_request(
    body: TranslateAgenticRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/translate-agentic",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_create_cache_request(
    body: CreateCacheRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        "/v1/assisted-query/create-cache",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


def make_compare_distributions_request(
    body: CompareDistributionsRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        seer_anomaly_detection_default_connection_pool,
        "/v1/workflows/compare/cohort",
        body=orjson.dumps(body),
        timeout=timeout,
        viewer_context=viewer_context,
    )


class DeleteGroupingRecordsByProjectRequest(TypedDict):
    project_id: int


def make_delete_grouping_records_by_project_request(
    body: DeleteGroupingRecordsByProjectRequest,
    timeout: int | float | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    project_id = body["project_id"]
    return make_signed_seer_api_request(
        seer_grouping_default_connection_pool,
        f"/v0/issues/similar-issues/grouping-record/delete/{project_id}",
        body=b"",
        method="GET",
        timeout=timeout,
        viewer_context=viewer_context,
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
        metrics.incr("seer.unsigned_request", sample_rate=1.0)
    return auth_headers


def sign_viewer_context(context_bytes: bytes) -> str:
    """Sign the viewer context payload with the shared secret."""
    return hmac.new(
        settings.SEER_API_SHARED_SECRET.encode("utf-8"),
        context_bytes,
        hashlib.sha256,
    ).hexdigest()

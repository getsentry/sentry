"""
A collection of human- and LLM-friendly models to represent Sentry data like issues, traces, and profiles.
These should be kept in sync with the models in Seer.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, ParamSpec

from pydantic import BaseModel, Field

_P = ParamSpec("_P")


class Transaction(BaseModel):
    name: str
    project_id: int


class Span(BaseModel):
    span_id: str
    parent_span_id: str | None
    span_op: str | None
    span_description: str | None


class TraceData(BaseModel):
    trace_id: str
    project_id: int
    transaction_name: str
    total_spans: int
    spans: list[Span]


class TraceMetadata(BaseModel):
    trace_id: str
    transaction_name: str


class EAPTrace(BaseModel):
    """
    Based on the Seer model. `trace` can contain both span and error events (see `SerializedEvent`).
    Spans contain connected error data in `span.errors` and `span.occurrences`.
    Child spans are nested recursively in span.children.
    """

    trace_id: str = Field(..., description="ID of the trace")
    org_id: int | None = Field(default=None, description="ID of the organization")
    trace: list[dict[str, Any]] = Field(..., description="List of spans and errors in the trace")


class ExecutionTreeNode(BaseModel):
    function: str
    module: str
    filename: str
    lineno: int
    in_app: bool
    children: list[ExecutionTreeNode]
    node_id: str | None = None
    sample_count: int = 0
    first_seen_ns: int | None = None
    last_seen_ns: int | None = None
    duration_ns: int | None = None


class ProfileData(BaseModel):
    profile_id: str
    transaction_name: str | None
    execution_tree: list[ExecutionTreeNode]
    project_id: int
    start_ts: float | None = None
    end_ts: float | None = None
    is_continuous: bool = False


class TraceProfiles(BaseModel):
    trace_id: str
    project_id: int
    profiles: list[ProfileData]


class IssueDetails(BaseModel):
    id: int
    title: str
    short_id: str | None = None
    culprit: str | None
    transaction: str | None
    events: list[dict[str, Any]]
    metadata: dict[str, Any] = {}
    message: str = ""
    project: int | None = None
    filename: str | None = None
    function: str | None = None


class TransactionIssues(BaseModel):
    transaction_name: str
    project_id: int
    issues: list[IssueDetails]


# ── Seer RPC response models ────────────────────────────────────────────────
# Pydantic response shapes for functions registered in `seer_method_registry`,
# `public_org_seer_method_registry`, or `public_project_seer_method_registry`.


class EmptyResponse(BaseModel):
    """Sentinel for RPC methods whose pre-typed not-found shape was `{}`.

    `EmptyResponse().dict()` is `{}`, so a return of `SomeModel | EmptyResponse`
    preserves the original wire bytes for the empty path while still satisfying
    the typed-registry contract. Use this instead of `| None` when the
    pre-migration code returned `{}` to indicate the no-data case.
    """


class OpaqueDictResponse(BaseModel):
    """Passthrough wrapper for RPC methods whose return is a `dict[str, Any]`
    with no explicit declared schema.

    Construct via `OpaqueDictResponse(__root__=data)` (or `.parse_obj(data)`);
    `.dict()` returns the underlying dict verbatim. Wire-no-op against the
    pre-typed `dict[str, Any]` return shape.

    Exposes dict-like read access (`__getitem__`, `get`, `__contains__`) so
    in-process callers that previously held a `dict` can keep using subscript
    + `.get()` without an explicit unwrap. Long-term, replace this with an
    explicit `BaseModel` subclass once the actual fields are known.
    """

    __root__: dict[str, Any]

    def dict(self, **kwargs: Any) -> dict[str, Any]:
        return self.__root__

    def __getitem__(self, key: str) -> Any:
        return self.__root__[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.__root__.get(key, default)

    def __contains__(self, key: object) -> bool:
        return key in self.__root__


def as_opaque_dict_response(
    fn: Callable[_P, dict[str, Any] | None],
) -> Callable[_P, OpaqueDictResponse | None]:
    """Adapter for RPC methods whose internal return is a `dict[str, Any] | None`.

    Returns a callable that wraps the underlying dict in `OpaqueDictResponse`
    (preserving wire bytes) so the registered method satisfies the typed
    registry contract without changing the function body. Long-term, replace
    with an explicit `BaseModel` subclass on the underlying function.
    """

    def opaque_dict_wrapper(*args: _P.args, **kwargs: _P.kwargs) -> OpaqueDictResponse | None:
        result = fn(*args, **kwargs)
        if result is None:
            return None
        return OpaqueDictResponse(__root__=result)

    return opaque_dict_wrapper


class OpaqueListResponse(BaseModel):
    """Passthrough wrapper for RPC methods whose return is a top-level
    `list[Any]` with no explicit declared schema.

    `.dict()` returns the underlying list verbatim (overriding pydantic's
    dict shape), preserving the bare-array wire bytes for callers whose
    pre-typed return was a JSON array. As with `OpaqueDictResponse`, this is
    transitional — replace with an explicit `BaseModel` once the actual
    element shape is known.
    """

    __root__: list[Any]

    def dict(self, **kwargs: Any) -> list[Any]:  # type: ignore[override]
        return self.__root__

    def __getitem__(self, idx: int) -> Any:
        return self.__root__[idx]

    def __iter__(self) -> Any:
        return iter(self.__root__)

    def __len__(self) -> int:
        return len(self.__root__)


def as_opaque_list_response(
    fn: Callable[_P, list[Any] | None],
) -> Callable[_P, OpaqueListResponse | None]:
    """Adapter for RPC methods whose internal return is `list[Any] | None`."""

    def opaque_list_wrapper(*args: _P.args, **kwargs: _P.kwargs) -> OpaqueListResponse | None:
        result = fn(*args, **kwargs)
        if result is None:
            return None
        return OpaqueListResponse(__root__=result)

    return opaque_list_wrapper


class OrganizationSlugResponse(BaseModel):
    slug: str


class OrganizationProject(BaseModel):
    id: int
    slug: str


class OrganizationProjectIdsResponse(BaseModel):
    projects: list[OrganizationProject]


class OrganizationFeaturesResponse(BaseModel):
    features: list[str]


class OrganizationAutofixConsentResponse(BaseModel):
    consent: bool


class GitHubEnterpriseConfigSuccessResponse(BaseModel):
    success: Literal[True] = True
    base_url: str
    verify_ssl: bool
    encrypted_access_token: str
    permissions: dict[str, Any]


class GitHubEnterpriseConfigErrorResponse(BaseModel):
    success: Literal[False] = False


class SendSeerWebhookSuccessResponse(BaseModel):
    success: Literal[True] = True


class SendSeerWebhookErrorResponse(BaseModel):
    success: Literal[False] = False
    error: str


class RepositoryIntegrationsStatusResponse(BaseModel):
    integration_ids: list[int | None]


class HasRepoCodeMappingsResponse(BaseModel):
    has_code_mappings: bool
    project_slug_to_id: dict[str, int]


class ValidateRepoSuccessResponse(BaseModel):
    valid: Literal[True] = True
    integration_id: int | None


class ValidateRepoErrorResponse(BaseModel):
    valid: Literal[False] = False
    reason: str


class GetRepoInstallationIdSuccessResponse(BaseModel):
    installation_id: int | str
    permissions: dict[str, Any] | None

    class Config:
        # GitHub returns the installation_id as a str; GitHub Enterprise stores
        # it as an int in metadata. smart_union preserves the runtime type
        # instead of coercing through the first matching union arm.
        smart_union = True


class GetRepoInstallationIdErrorResponse(BaseModel):
    error: str


class ProfileDetailsResponse(BaseModel):
    profile_matches_issue: Literal[True] = True
    execution_tree: list[ExecutionTreeNode]


class SpanAttribute(BaseModel):
    name: str
    type: str
    value: str | int | float | bool | list[str | int | float | bool] | None


class SpanAttributesResponse(BaseModel):
    attributes: list[SpanAttribute]

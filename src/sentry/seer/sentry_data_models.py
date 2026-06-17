"""
A collection of human- and LLM-friendly models to represent Sentry data like issues, traces, and profiles.
These should be kept in sync with the models in Seer.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


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


class BuiltInField(BaseModel):
    key: str
    type: str


class AttributeNamesResponse(BaseModel):
    fields: dict[str, list[str]]
    built_in_fields: list[BuiltInField]


class AttributeBucket(BaseModel):
    value: str
    count: float


class AttributesAndValuesResponse(BaseModel):
    attributes_and_values: dict[str, list[AttributeBucket]]


class MetricMetadataRow(BaseModel):
    name: str
    type: str
    unit: str
    count: int


class MetricMetadataSuccessResponse(BaseModel):
    candidates: list[MetricMetadataRow]
    has_more: bool


class MetricMetadataErrorResponse(BaseModel):
    candidates: list[MetricMetadataRow]
    has_more: bool
    error: str


class GetDsnResponse(BaseModel):
    project_slug: str
    platform: str | None
    dsn_public: str


class RepositoryDefinitionResponse(BaseModel):
    organization_id: int
    integration_id: str | None
    provider: str | None
    owner: str
    name: str
    external_id: str | None


class EventFilterKeyEntry(BaseModel):
    type: str


class EventFilterKeysResponse(BaseModel):
    __root__: dict[str, EventFilterKeyEntry]

    def dict(self, **kwargs: Any) -> Any:
        # Unwrap to the bare `{key: {...}}` map the seer caller expects.
        return {k: v.dict(**kwargs) for k, v in self.__root__.items()}


class EventFilterKeyValue(BaseModel):
    # Subset of TagValueSerializerResponse — `get_event_filter_key_values` filters
    # the upstream dict to these four keys, so the wire shape only carries them.
    # `value` matches `TagValueSerializerResponse.value` (`str | None`); the
    # tag-values endpoint can return `value: null` and the pre-typed code passed
    # those rows through verbatim. `lastSeen`/`firstSeen` arrive from the tags
    # API as `datetime` objects and are stringified by DRF's JSON renderer at the
    # dispatcher edge — typed as `Any` so Pydantic doesn't reject the pre-render
    # value.
    value: str | None
    count: int | None = None
    lastSeen: Any = None
    firstSeen: Any = None


class EventFilterKeyValuesResponse(BaseModel):
    __root__: list[EventFilterKeyValue]

    def dict(self, **kwargs: Any) -> Any:
        # Built-in / static paths return `[{"value": x}]` — `exclude_unset` keeps the
        # output minimal so count/lastSeen/firstSeen don't appear as None.
        kwargs.setdefault("exclude_unset", True)
        return [v.dict(**kwargs) for v in self.__root__]

    # List-like proxy: callers iterate the response as if it were the underlying
    # `list[dict]` it serializes to. The wire shape lives in `.dict()`.
    def __iter__(self) -> Any:
        return iter(self.dict())

    def __len__(self) -> int:
        return len(self.__root__)

    def __getitem__(self, idx: int) -> Any:
        return self.dict()[idx]

    def __eq__(self, other: object) -> bool:
        if isinstance(other, list):
            return self.dict() == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)


class TagFilterKeyValue(BaseModel):
    # Full TagValueSerializerResponse shape. Built-in static results may only carry
    # `value`; tag/feature-flag merges fill in the rest. Field-declaration order
    # mirrors `TagValueSerializerResponse` so the wire byte order is preserved.
    # `lastSeen`/`firstSeen` arrive as `datetime` objects pre-render — see
    # `EventFilterKeyValue` for the rationale on `Any`.
    key: str | None = None
    name: str | None = None
    value: str
    count: int | None = None
    lastSeen: Any = None
    firstSeen: Any = None
    query: str | None = None


class FilterKeyValuesResponse(BaseModel):
    __root__: list[TagFilterKeyValue]

    def dict(self, **kwargs: Any) -> Any:
        kwargs.setdefault("exclude_unset", True)
        return [v.dict(**kwargs) for v in self.__root__]

    def __iter__(self) -> Any:
        return iter(self.dict())

    def __len__(self) -> int:
        return len(self.__root__)

    def __getitem__(self, idx: int) -> Any:
        return self.dict()[idx]

    def __eq__(self, other: object) -> bool:
        if isinstance(other, list):
            return self.dict() == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)


class IssueFilterBuiltInField(BaseModel):
    key: str
    values: list[str]


class IssueFilterKeysResponse(BaseModel):
    # `tags`/`feature_flags` items are the `TagKeySerializerResponse` shape passed
    # through verbatim from the tags API. Top-level field names are typed for SDK
    # consumers; item shape stays opaque to preserve the upstream wire bytes.
    tags: list[dict[str, Any]]
    feature_flags: list[dict[str, Any]]
    built_in_fields: list[IssueFilterBuiltInField]


class AttributeValuesResponse(BaseModel):
    """Bare `{field: [value, ...]}` map returned by `get_attribute_values_with_substring`."""

    __root__: dict[str, list[str]]

    def dict(self, **kwargs: Any) -> Any:
        # Pre-typed code returned `{field: sorted_list, ...}` directly — unwrap so
        # the dispatcher and downstream consumers see the bare map.
        return dict(self.__root__)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, dict):
            return self.dict() == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)


class TraceItemAttributesResponse(BaseModel):
    """`get_trace_item_attributes` returns `{"attributes": [...]}` for a single trace item.

    Items in `attributes` are the raw attribute dicts from the trace-items API —
    passed through verbatim to preserve the upstream wire shape."""

    attributes: list[dict[str, Any]]


class TraceItemEventsResponse(BaseModel):
    """`get_log_attributes_for_trace` and `get_metric_attributes_for_trace` return
    `{"data": [{"id", "timestamp", "attributes"}, ...]}` — the EAP GetTrace output."""

    data: list[dict[str, Any]]


class ExecuteQuerySuccessResponse(BaseModel):
    """Success shape for `execute_table_query`, `execute_trace_table_query`, and
    `execute_replays_query`: `{"data": [...], "meta": {...}}`. `meta` is omitted
    from the wire when the upstream call didn't return one (e.g. the no-projects
    short-circuit in `execute_replays_query`), which is why we lean on
    `exclude_unset` instead of emitting `"meta": None`."""

    data: list[dict[str, Any]]
    meta: dict[str, Any] | None = None

    def dict(self, **kwargs: Any) -> Any:
        kwargs.setdefault("exclude_unset", True)
        return super().dict(**kwargs)

    # Dict-like proxy so tests that read `result["data"]` / `"meta" in result`
    # keep working — wire shape lives in `.dict()`.
    def __contains__(self, key: object) -> bool:
        return key in self.dict()

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]


class ExecuteQueryErrorResponse(BaseModel):
    """Error shape returned by the execute_* family on a 400 / validation failure:
    `{"error": <detail>}`. Discriminated against `ExecuteQuerySuccessResponse` by
    the presence of `error` vs `data`."""

    error: str

    def __contains__(self, key: object) -> bool:
        return key in self.dict()

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

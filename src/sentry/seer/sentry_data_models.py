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


class OrganizationProjectDetail(BaseModel):
    id: int
    slug: str
    instrumentation: list[str]


class OrganizationProjectsResponse(BaseModel):
    projects: list[OrganizationProjectDetail]


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


class HasRepoCodeMappingsResponse(BaseModel):
    has_code_mappings: bool
    project_slug_to_id: dict[str, int]


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
    # Attribute metadata (brief, examples, isDeprecated, replacementAttribute,
    # ...) for the attribute, populated when the caller requests
    # `expand="context"`; otherwise None. Today the metadata comes from the
    # sentry conventions, so only attributes that map to a known convention
    # carry it, but custom attribute context is planned and will populate this
    # for user-defined attributes too.
    context: dict[str, Any] | None = None


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
    # Authored context (brief, details) for the metric, populated only when the
    # caller passes include_context=True (and the metric has context); otherwise
    # None. Mirrors the attributes context shape (see BuiltInField.context).
    context: dict[str, Any] | None = None


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


class _DictProxyMixin(BaseModel):
    """Mixin that lets typed RPC response models be read like dicts so existing
    seer-side callers (and tests) can keep using `result["key"]` / `result.get`
    instead of attribute access. The wire shape always comes from `.dict()`."""

    def __contains__(self, key: object) -> bool:
        return key in self.dict()

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.dict().get(key, default)


class EventDetailsResponse(_DictProxyMixin):
    """`get_event_details` returns the serialized event plus a few lookup keys."""

    event: dict[str, Any]
    event_id: str
    event_trace_id: str | None
    project_id: int
    project_slug: str


class IssueDetailsResponse(_DictProxyMixin):
    """`get_issue_details` returns the serialized issue plus event-context extras."""

    issue: dict[str, Any]
    event_timeseries: dict[str, Any] | None
    timeseries_stats_period: str | None
    timeseries_interval: str | None
    tags_overview: dict[str, Any] | None
    user_activity: list[dict[str, Any]]
    project_id: int
    project_slug: str


class IssueAndEventDetailsResponse(_DictProxyMixin):
    """`get_issue_and_event_details_v2` returns the event fields always, plus the
    issue fields when `include_issue=True` and a group is associated with the
    event. `exclude_unset` keeps the issue keys absent from the wire when they
    weren't included."""

    event: dict[str, Any]
    event_id: str
    event_trace_id: str | None
    project_id: int
    project_slug: str
    issue: dict[str, Any] | None = None
    event_timeseries: dict[str, Any] | None = None
    timeseries_stats_period: str | None = None
    timeseries_interval: str | None = None
    tags_overview: dict[str, Any] | None = None
    user_activity: list[dict[str, Any]] | None = None

    def dict(self, **kwargs: Any) -> Any:
        kwargs.setdefault("exclude_unset", True)
        return super().dict(**kwargs)


class IssueCommittersResponse(_DictProxyMixin):
    """`get_issue_committers` returns the likely code authors for an issue, combining
    three commit-derived signals: `stack_commits` (frame-blame authors of the files in
    the stacktrace), `suspect_commits` (the precomputed GroupOwner suspect commits), and
    `release_commits` (a broader pool of commits shipped around when the issue first
    appeared). The entries are `CommitSerializer` / committer-serializer output enriched
    with extra keys (score, files_changed_count, is_merge_commit) — wider than
    sentry-side can lock down — so the lists are dict passthroughs."""

    stack_commits: list[dict[str, Any]]
    suspect_commits: list[dict[str, Any]]
    release_commits: list[dict[str, Any]]
    project_id: int
    project_slug: str


class IssueOwner(BaseModel):
    """A resolved code owner of an issue's failing files. Exactly one of the identity
    fields is set: `email` for a `user`, `slug` for a `team`. `name` is the display
    name when known. Kept fully typed (not a dict passthrough) so the same model can be
    reused for RPC request/response validation on both sides of the wire."""

    type: Literal["user", "team"]
    name: str | None = None
    email: str | None = None
    slug: str | None = None


class IssueOwnershipResponse(_DictProxyMixin):
    """`get_issue_ownership` returns the *configured* code owners (Ownership Rules /
    CODEOWNERS) for the files in an issue's stacktrace — who is RESPONSIBLE for the
    area, independent of who authored any commit. Useful when there's no suspect commit
    (e.g. infra/transient errors) but the area still has a clear owner.

    `owners` is the ordered list of resolved users/teams; `matched_rules` are the rule
    patterns that matched the failing files. `auto_assignment` reports whether Sentry is
    already auto-assigning issues from these rules — when False, the configured owners
    exist but nothing acts on them, which is precisely where a suggested assignee adds
    value. Empty `owners` means no rule covered the failing files."""

    owners: list[IssueOwner]
    matched_rules: list[str]
    auto_assignment: bool
    project_id: int
    project_slug: str


class TeamMembersResponse(_DictProxyMixin):
    """`get_team_members` returns the active users on a team, letting the agent drill from
    a team-level owner (e.g. one returned by `get_issue_ownership`) down to individual
    users — the eventual target when suggesting an assignee. `members` reuses `IssueOwner`
    (always `type="user"`, with `email`/`name`); it is empty when the team has no active
    members. Returns `None` (not this model) when the team can't be found."""

    team_id: int
    team_slug: str
    team_name: str
    members: list[IssueOwner]


class TransactionsForProjectResponse(BaseModel):
    """`get_transactions_for_project` returns `{"transactions": [...]}` over the
    project-scoped registry. Wraps the existing `Transaction` model so the SDK
    consumer sees the inner shape."""

    transactions: list[Transaction]


class UpdatePrMetricsSuccessResponse(BaseModel):
    """`update_pr_metrics` success: `{"success": true}`. The `success` literal is
    the discriminator against the error shape below."""

    success: Literal[True] = True


class UpdatePrMetricsErrorResponse(BaseModel):
    """`update_pr_metrics` error: `{"success": false, "error": <code>}`. `error`
    is one of `invalid_verdict`, `invalid_attribution`, `pull_request_not_found`,
    `pull_request_not_terminal`."""

    success: Literal[False] = False
    error: str


class BaselineTagDistributionEntry(BaseModel):
    tag_key: str
    tag_value: str
    count: int

    # Inline dict-proxy: lets test sites and seer callers read entries with
    # `entry["tag_key"]` until they're migrated to attribute access.
    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __contains__(self, key: object) -> bool:
        return key in self.dict()


class BaselineTagDistributionResponse(BaseModel):
    """`get_baseline_tag_distribution` returns
    `{"baseline_tag_distribution": [{tag_key, tag_value, count}, ...]}`."""

    baseline_tag_distribution: list[BaselineTagDistributionEntry]

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __contains__(self, key: object) -> bool:
        return key in self.dict()


class AgentExportIndexesResponse(BaseModel):
    """`export_explorer_indexes` returns the seer-side export of the explorer
    index tables: `{"org_id", "version", "tables"}` where `tables` is a map of
    table name → list of rows. Migrated from a TypedDict shape so the seer SDK
    consumer sees the contract through the typed registry."""

    org_id: int
    version: int
    tables: dict[str, list[dict[str, Any]]]


class ReplayMetadataResponse(BaseModel):
    """`get_replay_metadata` returns the aggregate replay-event response dict
    plus an added `project_slug` field. The replay-events shape is the
    `ReplayDetailsResponse` typedict-ish from the replays UI — wider than what
    sentry-side can lock down — so the body is a dict passthrough."""

    __root__: dict[str, Any]

    def dict(self, **kwargs: Any) -> Any:
        return dict(self.__root__)

    def __getitem__(self, key: str) -> Any:
        return self.__root__[key]

    def __contains__(self, key: object) -> bool:
        return key in self.__root__


class ProfileFlamegraphMetadata(BaseModel):
    profile_id: str
    project_id: int
    is_continuous: bool
    # `start_ts`/`end_ts` are float seconds from `min(precise.start_ts)` /
    # `max(precise.finish_ts)` aggregates — Pydantic v1 truncates `float → int`
    # silently, so type as float to preserve sub-second precision on the wire.
    start_ts: float | None
    end_ts: float | None
    # `selected_thread_id` is the dict key from a `dict[str, int]` count map in
    # `_convert_profile_to_execution_tree` — always a string.
    thread_id: str | None


class ProfileFlamegraphSuccessResponse(BaseModel):
    """`rpc_get_profile_flamegraph` success: `{"execution_tree", "metadata"}`.
    `execution_tree` items are dicts (not Pydantic models — the converter at
    `_convert_profile_to_execution_tree` returns dicts) so they pass through."""

    execution_tree: list[dict[str, Any]]
    metadata: ProfileFlamegraphMetadata

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __contains__(self, key: object) -> bool:
        return key in self.dict()


class ProfileFlamegraphErrorResponse(BaseModel):
    """`rpc_get_profile_flamegraph` error: `{"error": <detail>}`. Discriminated
    against the success shape by the presence of `error` vs `execution_tree`."""

    error: str

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __contains__(self, key: object) -> bool:
        return key in self.dict()


class ReplaySummaryLogsResponse(BaseModel):
    """`rpc_get_replay_summary_logs` returns `{"logs": [<log_str>, ...]}`."""

    logs: list[str]

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __contains__(self, key: object) -> bool:
        return key in self.dict()


class ErrorEventDetailsResponse(BaseModel):
    """`get_error_event_details` returns the bare `EventSerializer` output —
    a `SentryEventData`-shaped dict the seer caller casts to its own typed
    model. The shape is too wide for sentry-side to lock down here, so the
    body is a dict passthrough."""

    __root__: dict[str, Any]

    def dict(self, **kwargs: Any) -> Any:
        return dict(self.__root__)

    def __getitem__(self, key: str) -> Any:
        return self.__root__[key]

    def __contains__(self, key: object) -> bool:
        return key in self.__root__


class IssuesStatsResponse(BaseModel):
    """`get_issues_stats` returns the issues-stats API response verbatim — a list
    of dicts with `id, count, userCount, firstSeen, lastSeen, stats, lifetime`.
    Items are passed through since the issues-stats shape is wider than the
    documented contract and the seer caller treats it as a record stream."""

    __root__: list[dict[str, Any]]

    def dict(self, **kwargs: Any) -> Any:
        # Unwrap to the bare list the dispatcher previously returned.
        return list(self.__root__)

    # List-like proxy so callers can treat the response like the list it
    # serializes to.
    def __iter__(self) -> Any:
        return iter(self.__root__)

    def __len__(self) -> int:
        return len(self.__root__)

    def __getitem__(self, idx: int) -> Any:
        return self.__root__[idx]

    def __eq__(self, other: object) -> bool:
        if isinstance(other, list):
            return list(self.__root__) == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)


class CallCustomToolResponse(BaseModel):
    """`call_custom_tool` returns the bare string the tool's `execute()` produced.
    Wraps in a `__root__` passthrough so the wire stays a JSON string."""

    __root__: str

    def dict(self, **kwargs: Any) -> Any:
        # Unwrap so the dispatcher serializes the bare string the pre-typed
        # registry emitted, not `{"__root__": "..."}`.
        return self.__root__

    def __eq__(self, other: object) -> bool:
        # Match the legacy wire shape (bare str) so callers comparing against
        # `result == "literal"` keep working without an explicit `.dict()`.
        if isinstance(other, str):
            return self.__root__ == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)


class CreateIssueOccurrenceResponse(BaseModel):
    """`create_issue_occurrence` returns `{"success": True}` after a successful
    write. Pre-typed code never returned False here — failures raise — so the
    `success` field is a `Literal[True]` to encode the contract."""

    success: Literal[True] = True


class ExecuteIssuesQuerySuccessResponse(BaseModel):
    """`execute_issues_query` success path returns the bare list of issue dicts
    from the issues API. `__root__`-based passthrough preserves that shape."""

    __root__: list[dict[str, Any]]

    def dict(self, **kwargs: Any) -> Any:
        return list(self.__root__)

    def __iter__(self) -> Any:
        return iter(self.__root__)

    def __len__(self) -> int:
        return len(self.__root__)

    def __getitem__(self, idx: int) -> Any:
        return self.__root__[idx]

    def __eq__(self, other: object) -> bool:
        if isinstance(other, list):
            return list(self.__root__) == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)


class ExecuteTimeseriesQuerySuccessResponse(BaseModel):
    """`execute_timeseries_query` success shape has dynamic top-level keys —
    either `{metric_name: {"data": [...], ...}}` for non-grouped queries or
    `{group_value: {metric_name: ...}, ...}` for grouped ones — so the body
    is a dict passthrough. SDK consumers get a named response type plus the
    raw events-stats payload underneath."""

    __root__: dict[str, Any]

    def dict(self, **kwargs: Any) -> Any:
        return dict(self.__root__)

    # Dict-like proxy so test sites and seer callers can use `result[k]`,
    # `result.items()`, `len(result)`, etc. without first unwrapping `__root__`.
    def __contains__(self, key: object) -> bool:
        return key in self.__root__

    def __getitem__(self, key: str) -> Any:
        return self.__root__[key]

    def __len__(self) -> int:
        return len(self.__root__)

    def items(self) -> Any:
        return self.__root__.items()

    def keys(self) -> Any:
        return self.__root__.keys()

    def values(self) -> Any:
        return self.__root__.values()

    def get(self, key: str, default: Any = None) -> Any:
        return self.__root__.get(key, default)


class ExecuteTimeseriesQueryErrorResponse(BaseModel):
    """`execute_timeseries_query` error: `{"_seer_error_detail": <detail>}`. The
    underscore-prefixed key is reserved to avoid colliding with the dynamic
    metric/group keys in the success shape; `Field(alias=...)` keeps the wire
    spelling since Pydantic forbids underscore-prefixed attribute names."""

    seer_error_detail: str = Field(alias="_seer_error_detail")

    class Config:
        allow_population_by_field_name = True

    def dict(self, **kwargs: Any) -> Any:
        kwargs.setdefault("by_alias", True)
        return super().dict(**kwargs)

    def __contains__(self, key: object) -> bool:
        return key in self.dict()

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __eq__(self, other: object) -> bool:
        # Legacy callers compared against the bare wire dict
        # `{"_seer_error_detail": "..."}`. Preserve that ergonomics.
        if isinstance(other, dict):
            return self.dict() == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)


class MonitoringProviderConnectionData(BaseModel):
    provider_key: str
    url: str
    encrypted_auth_headers: dict[str, str] | None = None
    identity_id: int | None = None
    auth_method: str
    refreshable: bool = True
    gcp_project_ids: list[str] | None = None

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]


class MonitoringProviderConnectionsResponse(BaseModel):
    """`get_monitoring_provider_connections` success: the caller's connected
    monitoring provider identities, each carrying freshly-encrypted auth
    headers."""

    connections: list[MonitoringProviderConnectionData]

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]


class RefreshMonitoringProviderTokenSuccessResponse(BaseModel):
    encrypted_auth_headers: dict[str, str]
    expires: int | None

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __contains__(self, key: object) -> bool:
        return key in self.dict()


class RefreshMonitoringProviderTokenErrorResponse(BaseModel):
    """`refresh_monitoring_provider_token` error: `{"error": <code>}`. The
    error codes the function emits — one per refusal branch — encoded as a
    Literal so the seer-side caller can switch on them safely."""

    error: Literal[
        "encryption_failed",
        "identity_not_found",
        "identity_not_valid",
        "refresh_failed",
        "refresh_not_supported",
    ]

    def __getitem__(self, key: str) -> Any:
        return self.dict()[key]

    def __contains__(self, key: object) -> bool:
        return key in self.dict()

    def __eq__(self, other: object) -> bool:
        if isinstance(other, dict):
            return self.dict() == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return id(self)

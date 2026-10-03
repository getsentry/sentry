from __future__ import annotations

from typing import Any, NotRequired, TypedDict

# Mirrors Seer's StrategyOptions for the assisted-query agent.
SEARCH_AGENT_STRATEGIES = ("Traces", "Issues", "Logs", "Errors", "Metrics")


class SearchAgentChart(TypedDict):
    chart_type: int
    y_axes: list[str]
    interval: str | None


class SearchAgentQuery(TypedDict):
    query: str
    group_by: list[str]
    visualization: list[SearchAgentChart]
    sort: str
    # Empty when an absolute start/end range is used instead.
    stats_period: str
    start: str | None
    end: str | None
    mode: str
    result_count: int | None
    # Cross-event filters, only set for the Traces strategy.
    span_query: str | None
    log_query: str | None
    metric_query: str | None


# Seer's TranslateResponses, proxied as-is.
class SearchAgentTranslateResponse(TypedDict):
    responses: list[SearchAgentQuery]
    unsupported_reason: str | None
    run_id: int | None
    # The projects the query was scoped to, which can be broader than the ones requested.
    project_ids: list[int] | None
    reflection: dict[str, Any] | None


class SearchAgentStartResponse(TypedDict):
    # None until Seer has picked up the run; poll with sentry_run_id instead.
    run_id: int | None
    sentry_run_id: str


class SearchAgentStep(TypedDict):
    key: str


class _SearchAgentSessionOptional(TypedDict, total=False):
    run_id: int
    org_id: int
    org_slug: str
    natural_language_query: str
    strategy: str
    current_step: SearchAgentStep | None
    completed_steps: list[SearchAgentStep]
    final_query: str | None
    unsupported_reason: str | None
    final_response: SearchAgentTranslateResponse | None
    updated_at: str
    created_at: str


class SearchAgentSession(_SearchAgentSessionOptional):
    """Only `status` is set while the run is still being created in Seer."""

    status: str


class SearchAgentStateResponse(TypedDict):
    session: SearchAgentSession | None
    # None for legacy runs predating SeerRun mirroring, absent while the run is being created.
    sentry_run_id: NotRequired[str | None]

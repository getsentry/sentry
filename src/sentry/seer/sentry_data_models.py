"""
A collection of human- and LLM-friendly models to represent Sentry data like issues, traces, and profiles.
These should be kept in sync with the models in Seer.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


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
    span_id: str
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
    culprit: str | None
    transaction: str | None
    events: list[dict[str, Any]]


class TransactionIssues(BaseModel):
    transaction_name: str
    project_id: int
    issues: list[IssueDetails]

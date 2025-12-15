from enum import StrEnum
from typing import Literal, TypedDict

from pydantic import BaseModel


class BranchOverride(TypedDict):
    tag_name: str
    tag_value: str
    branch_name: str


class SummarizeIssueScores(BaseModel):
    possible_cause_confidence: float | None = None
    possible_cause_novelty: float | None = None
    is_fixable: bool | None = None
    fixability_score: float | None = None
    fixability_score_version: int | None = None


class SummarizeIssueResponse(BaseModel):
    group_id: str
    headline: str
    whats_wrong: str | None = None
    trace: str | None = None
    possible_cause: str | None = None
    scores: SummarizeIssueScores | None = None


class SeerRepoDefinition(BaseModel):
    organization_id: int | None = None
    integration_id: str | None = None
    provider: str
    owner: str
    name: str
    external_id: str
    branch_name: str | None = None
    branch_overrides: list[BranchOverride] = []
    instructions: str | None = None
    base_commit_sha: str | None = None
    provider_raw: str | None = None


class SpanInsight(BaseModel):
    explanation: str
    span_id: str
    span_op: str


class SummarizeTraceResponse(BaseModel):
    trace_id: str
    summary: str
    key_observations: str
    performance_characteristics: str
    suggested_investigations: list[SpanInsight]


class PageWebVitalsInsight(SpanInsight):
    trace_id: str
    suggestions: list[str]
    reference_url: str | None = None


class SummarizePageWebVitalsResponse(BaseModel):
    trace_ids: list[str]
    suggested_investigations: list[PageWebVitalsInsight]


class AutofixHandoffPoint(StrEnum):
    ROOT_CAUSE = "root_cause"


class SeerAutomationHandoffConfiguration(BaseModel):
    handoff_point: AutofixHandoffPoint
    target: Literal["cursor_background_agent"]
    integration_id: int
    auto_create_pr: bool = False


class SeerProjectPreference(BaseModel):
    organization_id: int
    project_id: int
    repositories: list[SeerRepoDefinition]
    automated_run_stopping_point: str | None = None
    automation_handoff: SeerAutomationHandoffConfiguration | None = None


class SeerRawPreferenceResponse(BaseModel):
    """Response model for Seer's /v1/project-preference endpoint."""

    preference: SeerProjectPreference | None


class PreferenceResponse(BaseModel):
    """Response model used by ProjectSeerPreferencesEndpoint which adds code_mapping_repos."""

    preference: SeerProjectPreference | None
    code_mapping_repos: list[SeerRepoDefinition]


class SeerApiError(Exception):
    def __init__(self, message: str, status: int):
        self.message = message
        self.status = status

    def __str__(self):
        return f"Seer API error: {self.message} (status: {self.status})"


class SeerApiResponseValidationError(Exception):
    def __init__(self, message: str):
        self.message = message

    def __str__(self):
        return f"Seer API response validation error: {self.message}"


class SeerPermissionError(Exception):
    def __init__(self, message: str):
        self.message = message

    def __str__(self):
        return f"Seer permission error: {self.message}"

from pydantic import BaseModel


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
    provider: str
    owner: str
    name: str
    external_id: str
    branch_name: str | None = None
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

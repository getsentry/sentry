from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class BranchOverride(BaseModel):
    tag_name: str = Field(description="The tag key to match against")
    tag_value: str = Field(description="The tag value to match against")
    branch_name: str = Field(description="The branch to use when this tag matches")


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
    branch_name: str | None = Field(
        default=None,
        description="The branch that will be used, otherwise the default branch will be used.",
    )
    branch_overrides: list[BranchOverride] = Field(
        default_factory=list,
        description="List of branch overrides based on event tags.",
    )
    instructions: str | None = Field(
        default=None,
        description="Custom instructions when working in this repo.",
    )
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


# =============================================================================
# Code Review Models (ported from Seer)
# =============================================================================

# Comment severity rankings for comparison
_COMMENT_SEVERITY_RANKINGS = {"low": 1, "medium": 2, "high": 3, "critical": 4}


class CommentSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

    def meets_minimum(self, minimum_severity: "CommentSeverity") -> bool:
        return (
            _COMMENT_SEVERITY_RANKINGS[self.value]
            >= _COMMENT_SEVERITY_RANKINGS[minimum_severity.value]
        )


class PrReviewFeature(StrEnum):
    BUG_PREDICTION = "bug_prediction"


class PrReviewTrigger(StrEnum):
    UNKNOWN = "unknown"
    ON_COMMAND_PHRASE = "on_command_phrase"
    ON_READY_FOR_REVIEW = "on_ready_for_review"
    ON_NEW_COMMIT = "on_new_commit"

    @classmethod
    def _missing_(cls: type["PrReviewTrigger"], value: object) -> "PrReviewTrigger":
        return cls.UNKNOWN


class BugPredictionSpecificInformation(BaseModel):
    callback_url: str | None = None
    organization_id: int | None = None
    organization_slug: str | None = None
    max_num_associations: int = 10
    max_num_issues_analyzed: int = 10
    should_post_to_overwatch: bool = False
    should_publish_comments: bool = False
    is_local_run: bool = False


class PrReviewConfig(BaseModel):
    features: dict[PrReviewFeature, bool] = Field(default_factory=lambda: {})
    trigger: PrReviewTrigger = PrReviewTrigger.ON_COMMAND_PHRASE
    trigger_comment_id: int | None = None
    trigger_comment_type: Literal["issue_comment"] | None = None
    trigger_user: str | None = None
    trigger_user_id: int | None = None

    def is_feature_enabled(self, feature: PrReviewFeature) -> bool:
        return self.features.get(feature, False)

    def get_minimum_severity_for_feature(self, feature: PrReviewFeature) -> CommentSeverity:
        return CommentSeverity.MEDIUM


class CodeReviewBaseRequest(BaseModel):
    repo: SeerRepoDefinition
    pr_id: int
    more_readable_repos: list[SeerRepoDefinition] = Field(default_factory=list)


class CodeReviewPrReviewRequest(CodeReviewBaseRequest):
    config: PrReviewConfig | None = None
    bug_prediction_specific_information: BugPredictionSpecificInformation | None = None


class CodeReviewTaskRequest(BaseModel):
    data: CodeReviewPrReviewRequest
    external_owner_id: str
    request_type: Literal["pr-review", "pr-closed"]

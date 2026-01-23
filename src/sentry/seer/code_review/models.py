from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from sentry.seer.models import SeerRepoDefinition

# =============================================================================
# Code Review Models (ported from Seer)
# =============================================================================


class CommentSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SeerCodeReviewFeature(StrEnum):
    BUG_PREDICTION = "bug_prediction"


class SeerCodeReviewTrigger(StrEnum):
    UNKNOWN = "unknown"
    ON_COMMAND_PHRASE = "on_command_phrase"
    ON_READY_FOR_REVIEW = "on_ready_for_review"
    ON_NEW_COMMIT = "on_new_commit"

    @classmethod
    def _missing_(cls: type[SeerCodeReviewTrigger], value: object) -> SeerCodeReviewTrigger:
        return cls.UNKNOWN


class SeerCodeReviewRequestType(StrEnum):
    """Request type for Seer code review requests."""

    PR_REVIEW = "pr-review"
    PR_CLOSED = "pr-closed"


class SeerCodeReviewConfig(BaseModel):
    features: dict[SeerCodeReviewFeature, bool] = Field(default_factory=lambda: {})
    trigger: SeerCodeReviewTrigger
    trigger_comment_id: int | None = None
    trigger_comment_type: Literal["issue_comment"] | None = None
    trigger_user: str | None = None
    trigger_user_id: int | None = None

    def is_feature_enabled(self, feature: SeerCodeReviewFeature) -> bool:
        return self.features.get(feature, False)

    def get_minimum_severity_for_feature(self, feature: SeerCodeReviewFeature) -> CommentSeverity:
        return CommentSeverity.MEDIUM


class BugPredictionSpecificInformation(BaseModel):
    """Information specific to bug prediction feature."""

    organization_id: int
    organization_slug: str


class SeerCodeReviewBaseRequest(BaseModel):
    repo: SeerRepoDefinition
    pr_id: int
    more_readable_repos: list[SeerRepoDefinition] = Field(default_factory=list)


class SeerCodeReviewRequest(SeerCodeReviewBaseRequest):
    bug_prediction_specific_information: BugPredictionSpecificInformation
    config: SeerCodeReviewConfig | None = None


class SeerCodeReviewTaskRequest(BaseModel):
    data: SeerCodeReviewRequest
    external_owner_id: str
    request_type: SeerCodeReviewRequestType

from __future__ import annotations

from datetime import datetime
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
    trigger_at: datetime | None = None  # When the trigger event occurred on GitHub
    sentry_received_trigger_at: datetime | None = None  # When Sentry received the webhook

    def is_feature_enabled(self, feature: SeerCodeReviewFeature) -> bool:
        return self.features.get(feature, False)

    def get_minimum_severity_for_feature(self, feature: SeerCodeReviewFeature) -> CommentSeverity:
        return CommentSeverity.MEDIUM


class BugPredictionSpecificInformation(BaseModel):
    """Information specific to bug prediction feature."""

    organization_id: int
    organization_slug: str


# =============================================================================
# Code Review Repo Definition Models
# =============================================================================


class SeerCodeReviewRepoDefinition(BaseModel):
    """
    Repo definition for code review with required fields for Sentry.

    This is a "shortened" version of SeerRepoDefinition that only includes
    the fields actually sent by Sentry for code review requests.
    """

    provider: str
    owner: str
    name: str
    external_id: str
    base_commit_sha: str
    # Optional in base, overridden in subclasses based on request type
    organization_id: int | None = None
    integration_id: str | None = None


class SeerCodeReviewRepoForPrReview(SeerCodeReviewRepoDefinition):
    """
    Repo definition for PR review requests.

    organization_id and integration_id are optional for PR review requests,
    though organization_id is typically included.
    """

    pass  # Inherits optional fields from base


class SeerCodeReviewRepoForPrClosed(SeerCodeReviewRepoDefinition):
    """
    Repo definition for PR closed requests.

    organization_id and integration_id are required for PR closed requests
    to support metrics and dashboarding.
    """

    organization_id: int  # Override to make required
    integration_id: str  # Override to make required


# =============================================================================
# Code Review Request Models
# =============================================================================


class SeerCodeReviewBaseRequest(BaseModel):
    repo: SeerRepoDefinition
    pr_id: int
    more_readable_repos: list[SeerRepoDefinition] = Field(default_factory=list)


class SeerCodeReviewRequest(SeerCodeReviewBaseRequest):
    bug_prediction_specific_information: BugPredictionSpecificInformation
    config: SeerCodeReviewConfig | None = None


class SeerCodeReviewRequestForPrReview(BaseModel):
    """Request model for PR review with optional organization_id and integration_id."""

    repo: SeerCodeReviewRepoForPrReview
    pr_id: int
    more_readable_repos: list[SeerCodeReviewRepoForPrReview] = Field(default_factory=list)
    bug_prediction_specific_information: BugPredictionSpecificInformation
    config: SeerCodeReviewConfig | None = None
    experiment_enabled: bool = False


class SeerCodeReviewRequestForPrClosed(BaseModel):
    """Request model for PR closed with required organization_id and integration_id."""

    repo: SeerCodeReviewRepoForPrClosed
    pr_id: int
    more_readable_repos: list[SeerCodeReviewRepoForPrClosed] = Field(default_factory=list)
    bug_prediction_specific_information: BugPredictionSpecificInformation
    config: SeerCodeReviewConfig | None = None


class SeerCodeReviewTaskRequest(BaseModel):
    data: SeerCodeReviewRequest
    external_owner_id: str
    request_type: SeerCodeReviewRequestType


class SeerCodeReviewTaskRequestForPrReview(BaseModel):
    """Task request wrapper for PR review."""

    data: SeerCodeReviewRequestForPrReview
    external_owner_id: str
    request_type: SeerCodeReviewRequestType


class SeerCodeReviewTaskRequestForPrClosed(BaseModel):
    """Task request wrapper for PR closed."""

    data: SeerCodeReviewRequestForPrClosed
    external_owner_id: str
    request_type: SeerCodeReviewRequestType

from __future__ import annotations

# Import shared models from sentry-seer-types package (v1 for Pydantic v1 compatibility)
from sentry_seer_types.v1.code_review import (
    BugPredictionSpecificInformation,
    CommentSeverity,
    SeerCodeReviewConfig,
    SeerCodeReviewFeature,
    SeerCodeReviewRequestForPrClosed,
    SeerCodeReviewRequestForPrReview,
    SeerCodeReviewRequestType,
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
    SeerCodeReviewTrigger,
)

# Re-export for backward compatibility
__all__ = [
    "BugPredictionSpecificInformation",
    "CommentSeverity",
    "SeerCodeReviewConfig",
    "SeerCodeReviewFeature",
    "SeerCodeReviewRequestForPrClosed",
    "SeerCodeReviewRequestForPrReview",
    "SeerCodeReviewRequestType",
    "SeerCodeReviewTaskRequestForPrClosed",
    "SeerCodeReviewTaskRequestForPrReview",
    "SeerCodeReviewTrigger",
]


# Note: The sentry-seer-types package provides dual Pydantic v1/v2 support.
# We import from v1.code_review since Sentry uses Pydantic v1.

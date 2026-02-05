from __future__ import annotations

from datetime import datetime

# Import shared models from sentry-seer-types package (v1 for Pydantic v1 compatibility)
from sentry_seer_types.v1.code_review import (
    BugPredictionSpecificInformation,
    CodegenPrReviewRequest as SeerCodeReviewRequestForPrReview,
    CodeReviewTaskRequest as SeerCodeReviewTaskRequestForPrReview,
    CommentSeverity,
    PrReviewConfig as SeerCodeReviewConfig,
    PrReviewFeature as SeerCodeReviewFeature,
    PrReviewTrigger as SeerCodeReviewTrigger,
    RequestType as SeerCodeReviewRequestType,
)

# Re-export for backward compatibility
__all__ = [
    "CommentSeverity",
    "SeerCodeReviewFeature",
    "SeerCodeReviewTrigger",
    "SeerCodeReviewRequestType",
    "SeerCodeReviewConfig",
    "BugPredictionSpecificInformation",
    "SeerCodeReviewRequestForPrReview",
    "SeerCodeReviewTaskRequestForPrReview",
]


# Note: The sentry-seer-types package provides dual Pydantic v1/v2 support.
# We import from v1.code_review since Sentry uses Pydantic v1.

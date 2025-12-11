from sentry import features
from sentry.constants import ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT, HIDE_AI_FEATURES_DEFAULT
from sentry.models.organization import Organization


def can_use_prevent_ai_features(org: Organization) -> bool:
    """Check if organization has opted in to Prevent AI features."""
    if not features.has("organizations:gen-ai-features", org):
        return False

    hide_ai_features = org.get_option("sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT)
    if hide_ai_features:
        return False

    if features.has("organizations:seat-based-seer-enabled", org):
        # Seat-based plan orgs don't need to check the PR review toggle
        return True

    # Usage-based plan orgs and others need to check the PR review toggle
    pr_review_test_generation_enabled = bool(
        org.get_option(
            "sentry:enable_pr_review_test_generation",
            ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
        )
    )
    return pr_review_test_generation_enabled

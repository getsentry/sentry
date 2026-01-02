from sentry import features
from sentry.constants import ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT, HIDE_AI_FEATURES_DEFAULT
from sentry.models.organization import Organization


def has_code_review_enabled(organization: Organization) -> bool:
    """
    Determine if the organization has code review enabled.
    """
    if not features.has("organizations:gen-ai-features", organization):
        return False

    hide_ai_features = organization.get_option("sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT)
    if hide_ai_features:
        return False

    pr_review_test_generation_enabled = bool(
        organization.get_option(
            "sentry:enable_pr_review_test_generation",
            ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
        )
    )
    if not pr_review_test_generation_enabled:
        return False

    # TODO: Remove the pr_review_test_generation_enabled check after the beta list is frozen
    return (
        features.has("organizations:code-review-beta", organization)
        or pr_review_test_generation_enabled
    )

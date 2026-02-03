from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User


def is_org_enabled_for_code_review_experiments(
    organization: Organization, user: User | None = None
) -> bool:
    """
    Checks if an org is eligible to code review experiments via Flagpole.

    If True the exact experiment is decided by Seer.
    If False no experiment will be applied to the PR, and it'll use the default behavior.
    """
    return features.has(
        "organizations:code-review-experiments-enabled",
        organization,
        actor=user,
    )

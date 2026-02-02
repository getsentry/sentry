import hashlib

from sentry import features, options
from sentry.models.organization import Organization
from sentry.users.models.user import User


def _get_hash_bucket(key: str, granularity: int = 100) -> int:
    """
    Get a deterministic hash bucket for a key.

    Uses SHA1 hashing to create consistent assignment across the same key.

    Args:
        key: The assignment key (e.g., "org_id:pr_id")
        granularity: Modulo granularity (default 100 for percentage-based bucketing)

    Returns:
        Integer bucket value between 0 and granularity-1
    """
    # Hash the key to get a consistent number
    hash_value = int(hashlib.sha1(key.encode("utf-8")).hexdigest(), 16)

    # Use modulo to get a value between 0 and granularity-1
    return hash_value % granularity


def get_code_review_experiment(
    organization: Organization,
    pr_id: str,
    user: User | None = None,
) -> str | None:
    """
    Determine which experiment this PR should be assigned to.

    Uses a weight-based system (like CSS flex-grow) where experiment weights
    determine proportional assignment. Each PR is hashed once to a bucket,
    then assigned based on cumulative weight ranges.

    Args:
        organization: The organization owning the PR
        pr_id: The pull request identifier (e.g., GitHub PR number)
        user: The user who opened the PR (optional)

    Returns:
        Experiment name (e.g., "noop-experiment", "cost-optimized") or None for control group

    Examples:
        >>> # Option: [["a", 1], ["b", 1]]
        >>> # Equal weights → 50% A, 50% B, 0% control
        >>>
        >>> # Option: [["a", 10], ["b", 1]]
        >>> # Weighted 10:1 → 90.9% A, 9.1% B, 0% control
        >>>
        >>> # Option: [["a", 0]]
        >>> # Weight 0 = disabled → 100% control (None)
        >>>
        >>> # Option: []
        >>> # No experiments → 100% control (None)
    """
    # Check if org is eligible for experiments via Flagpole
    if not features.has(
        "organizations:code-review-experiments-enabled",
        organization,
        actor=user,
    ):
        return None

    # Get experiment configurations from Options
    experiments: list[tuple[str, float]] = options.get("code-review.experiments")

    # Filter out disabled experiments (weight 0) and calculate total weight
    active_experiments = [(name, weight) for name, weight in experiments if weight > 0]

    if not active_experiments:
        return None

    total_weight = sum(weight for _, weight in active_experiments)

    # Hash PR once to get consistent bucket (0-99)
    assignment_key = f"{organization.id}:{pr_id}"
    bucket = _get_hash_bucket(assignment_key, granularity=100)

    # Assign based on cumulative weight ranges
    cumulative = 0.0
    for experiment_name, weight in active_experiments:
        # Calculate cumulative threshold as percentage (0-100)
        cumulative += (weight / total_weight) * 100

        if bucket < cumulative:
            return experiment_name

    # Fallback (should not reach here due to floating point precision)
    return None

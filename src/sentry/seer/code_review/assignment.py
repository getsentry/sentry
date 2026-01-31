import hashlib

from sentry import features, options
from sentry.models.organization import Organization
from sentry.users.models.user import User


def _hash_assignment_key(key: str, rollout_rate: float, granularity: int = 100) -> bool:
    """
    Deterministically decide if a key should be included in a rollout.

    Uses SHA1 hashing to create consistent assignment across the same key.

    Args:
        key: The assignment key (e.g., "org_id:pr_id:experiment_name")
        rollout_rate: Percentage as float (0.0 to 1.0)
        granularity: Modulo granularity (default 100 for percentage)

    Returns:
        True if the key is included in the rollout, False otherwise
    """
    # Hash the key to get a consistent number
    hash_value = int(hashlib.sha1(key.encode("utf-8")).hexdigest(), 16)

    # Use modulo to get a value between 0 and granularity-1
    bucket = hash_value % granularity

    # Check if this bucket is within the rollout percentage
    return bucket < (granularity * rollout_rate)


def get_code_review_experiment(
    organization: Organization,
    pr_id: str,
    user: User | None = None,
) -> str:
    """
    Determine which experiment this PR should be assigned to.

    Evaluates experiments in order from the code-review.experiments option.
    First matching experiment wins. Uses deterministic hashing for per-PR
    variable assignment.

    Args:
        organization: The organization owning the PR
        pr_id: The pull request identifier (e.g., GitHub PR number)
        user: The user who opened the PR (optional)

    Returns:
        Experiment name (e.g., "noop-experiment", "cost-optimized") or "baseline"

    Examples:
        >>> # Option: [["noop", 1.0], ["cost", 0.5]]
        >>> # All PRs get "noop" (100% rollout takes priority)
        >>>
        >>> # Option: [["noop", 0.0], ["cost", 0.5]]
        >>> # noop disabled, 50% of PRs get "cost", 50% get "baseline"
        >>>
        >>> # Option: []
        >>> # No experiments configured → all PRs get "baseline"
    """
    # Check if org is eligible for experiments via Flagpole
    if not features.has(
        "organizations:code-review-experiments-enabled",
        organization,
        actor=user,
    ):
        return "baseline"

    # Get experiment configurations from Options
    experiments: list[tuple[str, float]] = options.get("code-review.experiments")

    # Evaluate experiments in order - first match wins
    for experiment_name, rollout_rate in experiments:
        # Skip disabled experiments
        if rollout_rate <= 0.0:
            continue

        # Fully released experiment (100%)
        if rollout_rate >= 1.0:
            return experiment_name

        # Per-PR variable assignment using hash of org + PR + experiment
        # Including experiment_name ensures independent rollout per experiment
        assignment_key = f"{organization.id}:{pr_id}:{experiment_name}"
        if _hash_assignment_key(assignment_key, rollout_rate):
            return experiment_name

    # No experiment matched
    return "baseline"

from __future__ import annotations

from typing import Literal

from sentry import analytics


@analytics.eventclass("scm.pr.closed")
class PrCloseMetricsEvent(analytics.Event):
    """Analytics row emitted when a tracked PR is closed or merged.

    Carries only data Sentry already holds (no SCM fetch, no PR text). The schema
    is provisional and expected to grow.
    """

    organization_id: int
    repository_id: int
    pull_request_id: int
    # The PR number as stored on ``PullRequest.key`` (e.g. "5131" on GitHub).
    pr_key: str
    # Group (issue) IDs this PR resolves, from the resolving GroupLink rows
    # (parsed from the PR title/message). Empty when the PR resolves nothing.
    group_ids: list[int]
    close_action: Literal["closed", "merged"]
    # Always present on a close/merge webhook — read fail-fast so a malformed
    # payload errors loudly instead of emitting a silent null.
    head_commit_sha: str
    closed_at: str
    # Null when Sentry never saw the PR open (late-installed integration, missed
    # webhook, or a non-webhook creation path) — see ``PullRequest.opened_at``.
    opened_at: str | None = None
    # Null for a closed-but-unmerged PR (no merge commit / merge time).
    merge_commit_sha: str | None = None
    merged_at: str | None = None
    draft: bool = False
    # Structural counters read straight from the close/merge webhook payload (no
    # SCM round-trip). Text is never emitted — counts and metadata only.
    additions: int = 0
    deletions: int = 0
    files_changed: int = 0
    commits_count: int = 0
    comments_count: int = 0
    review_comments_count: int = 0
    is_assigned: bool = False
    # The point-in-time attribution snapshot at emit time: a JSON-encoded list of
    # the active (is_valid=True) attributions, each {signal_type, source,
    # signal_details}, ordered by attribution priority (highest-confidence first).
    attributions: str = "[]"
    # The Seer judge verdict (one of ``PullRequestVerdict``). Null on the no-judge
    # path and until the judge callback lands a result for a forwarded PR.
    verdict: str | None = None


analytics.register(PrCloseMetricsEvent)

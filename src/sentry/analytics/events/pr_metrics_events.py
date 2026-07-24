from __future__ import annotations

from dataclasses import field
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
    # Normalized SCM slug (e.g. "github", "gitlab"), read off Repository.provider
    # at emit time. Null when the Repository row is gone or its provider is unset.
    repository_provider: str | None = None
    # Whether the repo was public at PR-open time. Sourced from the "opened"
    # webhook payload's repository.private (Repository never persists visibility),
    # so it's null for PRs opened before this field existed or with activity
    # tracking off.
    repository_is_public: bool | None = None
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
    # Sentry Commit.id for the merge commit, resolved from merge_commit_sha via
    # the (repository_id, key) unique key. Null when the PR wasn't merged or
    # Sentry never recorded the landed commit (release tracking, not pr_metrics,
    # populates Commit rows).
    merge_commit_id: int | None = None
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
    # Derived from the stored activity log at the terminal event (not the webhook
    # payload above): ``reviews_count`` = total review submissions;
    # ``participants_count`` = distinct non-bot senders across the PR's activity.
    # Only meaningful under ``pr-metrics-activity``; 0 when activity isn't tracked.
    participants_count: int = 0
    reviews_count: int = 0
    # Human-involvement splits, also activity-derived — the "self-healing loop"
    # signals: which parts of the PR a human vs a bot drove. All default to their
    # unset value (0 / None) when activity isn't tracked.
    #
    # Reviews split by the reviewer's account class; the two sum to reviews_count.
    reviews_bot_count: int = 0
    reviews_human_count: int = 0
    # Net outstanding review requests at the terminal event (REVIEW_REQUESTED
    # minus REVIEW_REQUEST_REMOVED, floored at 0). Distinct from reviews_count:
    # this answers "was a review ever asked for", not "was one ever submitted",
    # so a requested-but-unreviewed PR doesn't look identical to one nobody was
    # ever asked to review.
    reviews_requested_count: int = 0
    # Every REVIEW_SUBMITTED tallied by its GitHub review state — JSON-encoded
    # {"approved": int, "changes_requested": int, "commented": int}, all three
    # keys always present (0 default) on an emitted row. A reviewer who submits
    # twice counts twice, same as reviews_count, which the three values sum to.
    # Activity-derived and unpersisted, like reviews_requested_count above (see
    # emit.review_activity). GitHub-only: this pipeline doesn't track GitLab
    # reviews, so every count is 0 for a GitLab-hosted PR — same as every other
    # activity-derived counter when activity isn't tracked. "{}" is only the
    # dataclass default, never an emitted value.
    review_results: str = "{}"
    # Pushes (opened + synchronize events) split by the pusher's account class. A
    # push, not a commit: GitHub's synchronize payload carries no commit count, so
    # this counts push events, with a bot-app push attributed to the bot.
    pushes_bot_count: int = 0
    pushes_human_count: int = 0
    # Who opened / closed the PR: True = Bot, False = human, null = the event was
    # never recorded (activity not tracked, or a missed webhook).
    opened_by_bot: bool | None = None
    closed_by_bot: bool | None = None
    # Whether the same actor opened and closed the PR (login comparison). Null when
    # either the opener or the closer is unknown.
    opened_and_closed_by_same_actor: bool | None = None
    # The point-in-time attribution snapshot at emit time: a JSON-encoded list of
    # the active (is_valid=True) attributions, each {signal_type, source,
    # signal_details}. A PR can carry more than one; all are emitted equally, with
    # no ranking between them — each is a definite attribution, not a probabilistic
    # guess. List order carries no meaning and isn't guaranteed; don't rely on it.
    attributions: str = "[]"
    # Distinct ``AutofixReferrer`` values (e.g. "slack", "night_shift") behind the
    # Seer runs that produced this PR's attributions, resolved via ``SeerRun`` at
    # emit time rather than stored on ``attributions`` itself — see
    # ``resolve_autofix_referrers``. Empty when no attribution carries a
    # resolvable Seer run id.
    autofix_referrers: list[str] = field(default_factory=list)
    # The terminal verdict, one of ``PullRequestVerdict``: the deterministic
    # outcome (``merged_unchanged`` / ``closed_unmerged``) on the no-judge path, or
    # the Seer judge's verdict on the judge path. Claimed before emit on both
    # paths (the claim gates emission), so every emitted row carries a verdict — the
    # ``| None`` is only the column's unset default, not an expected emitted value.
    # (The ``JUDGE_IN_PROGRESS`` reaper's indeterminate rows — no reliable local
    # signal to settle from — release the claim without emitting at all, rather
    # than emit a null-verdict row; see ``reap_stuck_judge_verdicts``.)
    verdict: str | None = None
    # Close-reason labels behind the verdict (e.g. out_of_scope_or_unwanted) — the
    # "why", a vocabulary shared across judges, not specific to any one. Mostly
    # judge-sourced, but Sentry's own deterministic CLOSED_UNMERGED path can also
    # set "ci_failing_at_close" (see pr_metrics.emit.ci_failing_at_close) — so a
    # non-null value doesn't by itself mean the row was judged. Repeated
    # free-string column; null when nothing applies. BigQuery-only.
    diagnosis_labels: list[str] | None = None

    # --- Conversation judge (set only on a judged close/merge row) ---
    # One of several judges' outputs. Columns are prefixed ``conversation_`` so a
    # future judge's columns sit alongside without collision, and to disambiguate
    # the judge's comment counts from the webhook ``comments_count`` above. Semantic
    # outputs are promoted to columns so dashboards group/filter directly; all are
    # null off the judge path and BigQuery-only. Enum-like values are free strings
    # so a Seer vocabulary change can't break the schema.
    #
    # positive | neutral | negative | mixed. Null when there was nothing to judge
    # (no comments) or the judge couldn't run; conversation_comments_total
    # disambiguates (0 = no comments, >0 = judge ran but produced no sentiment).
    conversation_sentiment: str | None = None
    # Comments split by author class — "did bots/humans comment?"
    conversation_comments_bot: int | None = None
    conversation_comments_human: int | None = None
    # conversation_comments_truncated > 0 means a chatty PR was capped before judging.
    conversation_comments_total: int | None = None
    conversation_comments_judged: int | None = None
    conversation_comments_truncated: int | None = None
    # The judge's drill-down detail (per-comment intents, reasoning, version
    # markers), JSON-encoded like ``attributions`` and stored verbatim. A future
    # judge gets its own ``*_metadata``.
    conversation_metadata: str | None = None


analytics.register(PrCloseMetricsEvent)

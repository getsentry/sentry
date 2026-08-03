"""Wire contracts for the PR-metrics ↔ Seer round-trip.

The pydantic models here are a manual mirror of Seer's PR-metrics contract — keep
them in sync with getsentry/seer:src/seer/pr_metrics/models.py. There's no shared
package or codegen; both sides validate with pydantic, so drift surfaces as a
``ValidationError`` here or a 4xx from Seer rather than silent corruption.
https://github.com/getsentry/seer/blob/main/src/seer/pr_metrics/models.py

- ``PrCloseJudgeRequest`` / ``PrActivityEvent`` shape the outbound forward
  (Sentry → Seer) assembled in ``judge.py``.
- ``PrConversationAnalysis`` mirrors the ``conversation_analysis`` Seer returns on
  the inbound callback (Seer → Sentry); it shapes the emitted ``PrCloseMetricsEvent``
  analytics row in ``emit.py`` and is never persisted.
"""

from __future__ import annotations

from typing import Any, Final, Literal

from pydantic import BaseModel

from sentry.seer.code_review.models import SeerCodeReviewRepoDefinition

# GitHub fires a single ``closed`` action for both outcomes; a set ``merged_at``
# on the PR row disambiguates a merge from a plain close.
CLOSE_ACTION_CLOSED: Final = "closed"
CLOSE_ACTION_MERGED: Final = "merged"
CLOSE_ACTION_ABANDONED: Final = "abandoned"

CloseAction = Literal["closed", "merged", "abandoned"]


class PrConversationAnalysis(BaseModel):
    """The conversation judge's analysis of a closed/merged PR — one of several
    judges, each with its own result type and columns.

    Mirrors the ``conversation_analysis`` Seer sends to ``update_pr_metrics`` — the
    inbound-callback half of the contract. BigQuery-only: it shapes the emitted
    ``PrCloseMetricsEvent`` (in ``emit.py``) and is never persisted. Enum-like
    values stay free strings, so a Seer vocabulary change can't fail validation.

    Extra keys are ignored (pydantic v1's default), deliberately: it keeps old
    Sentry pods forward-compatible with fields a newer Seer adds. The flip side — a
    near-miss payload that matches some field names populates those and silently
    leaves the rest null — is owned by the Seer-side builder + a shared contract
    test, not tightened here: ``extra="forbid"`` would fight both that forward-compat
    and the graceful-drop behavior (it'd drop the whole analysis on any new field).
    """

    # positive | neutral | negative | mixed. Null when there was nothing to judge
    # (no comments) or the judge couldn't run; comments_total disambiguates.
    sentiment: str | None = None
    # Comments split by author class.
    comments_bot: int | None = None
    comments_human: int | None = None
    # comments_truncated > 0 means a chatty PR was capped before judging.
    comments_total: int | None = None
    comments_judged: int | None = None
    comments_truncated: int | None = None
    # Opaque drill-down stored verbatim: per-comment intents, reasoning, version
    # markers, intent counts.
    metadata: dict[str, Any] | None = None


class PrActivityEvent(BaseModel):
    """One captured ``PullRequestActivity`` row, projected for the judge.

    The stored payloads are structural-only — titles, bodies, and comment text are
    excluded at capture — so the whole payload is safe to forward as-is.
    """

    event_type: str
    # When Sentry recorded the activity (≈ webhook arrival); preserves event order.
    timestamp: str
    payload: dict[str, Any]


class PrCloseJudgeRequest(BaseModel):
    """The Sentry → Seer judge request body; mirrors Seer's ``PrCloseJudgeRequest``.

    A pydantic model rather than a bare dict so the assembled body — including the
    ``repo`` sub-shape that ``build_repo_definition`` produces — is validated before
    send, catching contract drift here instead of as a Seer-side rejection.
    """

    organization_id: int
    repository_id: int
    pull_request_id: int
    # Reuses the shared repo-definition model (the validated shape of
    # build_repo_definition's output), so a dropped/renamed repo field is caught.
    repo: SeerCodeReviewRepoDefinition
    pr_number: str
    close_action: CloseAction
    head_commit_sha: str
    merge_commit_sha: str | None
    opened_at: str | None
    closed_at: str
    merged_at: str | None
    draft: bool
    additions: int
    deletions: int
    files_changed: int
    commits_count: int
    comments_count: int
    review_comments_count: int
    is_assigned: bool
    attributions: list[dict[str, Any]]
    group_ids: list[int]
    # The captured activity timeline, oldest first. Carries the event sequence and
    # actors that the end-state counters above flatten away: who pushed the
    # post-open commits (Bot vs human), review outcomes, labels, draft transitions.
    activity: list[PrActivityEvent]
    # Non-zero means the timeline above is incomplete, and specifically missing its
    # NEWEST events: capture drops lifecycle entries once the stored document hits
    # its entry cap, so the close/merge and final reviews — the events a verdict
    # leans on hardest — are the ones absent. The judge must not read a capped
    # timeline as the PR's full history. Defaulted so a Seer that predates the
    # field, or a replayed older request body, still validates.
    activity_events_dropped: int = 0

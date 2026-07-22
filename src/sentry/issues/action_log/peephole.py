"""
Peephole optimizer for lists of GroupActionLogEntry.

Given a list of entries in (-date_added, -id) order (newest first),
removes or rewrites entries that are redundant when shown in sequence.

Each rule is a function that inspects a prefix of the list and optionally
returns a rewritten version. Rules are applied repeatedly from the front
until no rule matches, then we advance one entry and try again.

To add a new rule, write a function that matches a prefix pattern and
append it to ``_RULES``. Rules should be easy to read so product people
can audit them for correctness.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import NamedTuple, Protocol

from sentry.issues.action_log.types import (
    AutofixPrCreatedAction,
    GroupAction,
    PullRequestMergedAction,
    ReferencedInCommitAction,
    ResolvedInPullRequestAction,
    SeerCodingCompletedAction,
    SeerCodingStartedAction,
    SeerIterationCompletedAction,
    SeerIterationStartedAction,
    SeerPRCreatedAction,
    SeerRCACompletedAction,
    SeerRCAStartedAction,
    SeerSolutionCompletedAction,
    SeerSolutionStartedAction,
    SetResolvedInCommitAction,
)


class ActionEntry(Protocol):
    @property
    def action(self) -> GroupAction: ...


class Rewrite(NamedTuple):
    """Result of a successful rule application."""

    keep: list[ActionEntry]
    rest: list[ActionEntry]


RewriteRule = Callable[[list[ActionEntry]], Rewrite | None]


# ---------------------------------------------------------------------------
# Rules
#
# Each rule inspects a prefix of the list (newest-first) and returns a
# (keep, rest) tuple if it wants to rewrite, or None to skip.
# ---------------------------------------------------------------------------


def _drop_started_before_completed(
    entries: list[ActionEntry],
) -> Rewrite | None:
    """If a Seer phase completed, drop the adjacent "started" entry."""
    actions = [e.action for e in entries[:2]]

    match actions:
        # RCA
        case [SeerRCACompletedAction(), SeerRCAStartedAction(), *_]:
            return Rewrite([entries[0]], entries[2:])
        case [SeerRCAStartedAction(), SeerRCACompletedAction(), *_]:
            return Rewrite([entries[1]], entries[2:])

        # Solution / plan
        case [SeerSolutionCompletedAction(), SeerSolutionStartedAction(), *_]:
            return Rewrite([entries[0]], entries[2:])
        case [SeerSolutionStartedAction(), SeerSolutionCompletedAction(), *_]:
            return Rewrite([entries[1]], entries[2:])

        # Coding
        case [SeerCodingCompletedAction(), SeerCodingStartedAction(), *_]:
            return Rewrite([entries[0]], entries[2:])
        case [SeerCodingStartedAction(), SeerCodingCompletedAction(), *_]:
            return Rewrite([entries[1]], entries[2:])

        # Iteration
        case [SeerIterationCompletedAction(), SeerIterationStartedAction(), *_]:
            return Rewrite([entries[0]], entries[2:])
        case [SeerIterationStartedAction(), SeerIterationCompletedAction(), *_]:
            return Rewrite([entries[1]], entries[2:])

    return None


def _drop_resolved_in_pr_near_pr_created(
    entries: list[ActionEntry],
) -> Rewrite | None:
    """'Referenced in pull request' is redundant when Seer or Autofix created it.

    Note: we can't compare PR IDs here. SeerPRCreatedAction stores GitHub PR
    numbers in nested dicts, while ResolvedInPullRequestAction stores a Sentry
    PullRequest model ID. Proximity is the best we can do without a DB lookup.
    """
    actions = [e.action for e in entries[:2]]

    match actions:
        case [SeerPRCreatedAction() | AutofixPrCreatedAction(), ResolvedInPullRequestAction()]:
            return Rewrite([entries[0]], entries[2:])
        case [ResolvedInPullRequestAction(), SeerPRCreatedAction() | AutofixPrCreatedAction()]:
            return Rewrite([entries[1]], entries[2:])

    return None


def _collapse_pr_merge_cluster(
    entries: list[ActionEntry],
) -> Rewrite | None:
    """When a PR merges, the surrounding resolve/reference entries are noise.

    Scans up to 4 entries for a PULL_REQUEST_MERGED, then drops entries
    that are just consequences of that merge (same PR for entries that
    carry a PR ID, proximity-only for commit-based entries).
    """
    window = entries[: min(4, len(entries))]
    actions = [e.action for e in window]

    # Find the merge and its PR ID.
    merge_idx: int | None = None
    merge_pr: int | None = None
    for i, action in enumerate(actions):
        match action:
            case PullRequestMergedAction(pull_request=pr):
                merge_idx = i
                merge_pr = pr
                break

    if merge_idx is None:
        return None

    keep: list[ActionEntry] = []
    dropped_any = False

    for i, action in enumerate(actions):
        if i == merge_idx:
            keep.append(window[i])
            continue

        match action:
            case ResolvedInPullRequestAction(pull_request=int() as pr) if pr == merge_pr:
                dropped_any = True
            case ReferencedInCommitAction() | SetResolvedInCommitAction():
                dropped_any = True
            case _:
                keep.append(window[i])

    if not dropped_any:
        return None

    return Rewrite(keep, entries[len(window) :])


_RULES: list[RewriteRule] = [
    _collapse_pr_merge_cluster,
    _drop_resolved_in_pr_near_pr_created,
    _drop_started_before_completed,
]


def peephole_optimize(
    entries: Sequence[ActionEntry],
) -> list[ActionEntry]:
    """Remove redundant entries from a (-date_added, -id) ordered list.

    Each entry must have an ``action`` property returning a GroupAction.
    Accepts GroupActionLogEntry instances or any object with that property.
    """
    remaining: list[ActionEntry] = list(entries)
    result: list[ActionEntry] = []

    while remaining:
        rewritten = False
        for rule in _RULES:
            rewrite = rule(remaining)
            if rewrite is not None:
                keep, remaining = rewrite
                result.extend(keep)
                rewritten = True
                break
        if not rewritten:
            result.append(remaining[0])
            remaining = remaining[1:]

    return result

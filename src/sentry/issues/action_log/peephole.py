"""
Peephole optimizer for lists of GroupActionLogEntry.

Given a list of entries in (-date_added, -id) order (newest first),
removes or rewrites entries that are redundant when shown in sequence.

Each rule is a function that inspects a prefix of the list and optionally
returns a rewritten version. Rules are applied repeatedly from the front
until no rule matches, then we advance one entry and try again.

To add a new rule, write a function that matches a prefix pattern and
register it with ``_register``. Rules should be easy to read so product
people can audit them for correctness.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import NamedTuple, Protocol

from sentry.issues.action_log.types import (
    AutofixPrCreatedAction,
    GroupAction,
    GroupActionType,
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
    type: int

    @property
    def action(self) -> GroupAction: ...


class Rewrite(NamedTuple):
    """Result of a successful rule application."""

    keep: list[ActionEntry]
    rest: list[ActionEntry]


RewriteRule = Callable[[list[ActionEntry]], Rewrite | None]

# Dispatch table: action type at position 0 → rules that might match.
# Rules registered with scope=None are tried for every entry.
_dispatch: dict[GroupActionType | None, list[RewriteRule]] = {}


def _register(
    scope: set[GroupActionType] | None,
    rule: RewriteRule,
) -> RewriteRule:
    """Register a rule under position-0 action types it can match.

    ``scope`` is the set of GroupActionTypes that can appear at entries[0]
    for this rule to be relevant. ``None`` means the rule may match any
    head entry and will always be tried.
    """
    if scope is None:
        _dispatch.setdefault(None, []).append(rule)
    else:
        for action_type in scope:
            _dispatch.setdefault(action_type, []).append(rule)
    return rule


def _rules_for(action_type: GroupActionType) -> Sequence[RewriteRule]:
    """Return the rules that could match a given position-0 type."""
    specific = _dispatch.get(action_type, ())
    wildcard = _dispatch.get(None, ())
    if not specific:
        return wildcard
    if not wildcard:
        return specific
    return [*specific, *wildcard]


# ---------------------------------------------------------------------------
# Rules
#
# Each rule inspects a prefix of the list (newest-first) and returns a
# Rewrite if it wants to rewrite, or None to skip.
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


_register(
    scope={
        GroupActionType.SEER_RCA_STARTED,
        GroupActionType.SEER_RCA_COMPLETED,
        GroupActionType.SEER_SOLUTION_STARTED,
        GroupActionType.SEER_SOLUTION_COMPLETED,
        GroupActionType.SEER_CODING_STARTED,
        GroupActionType.SEER_CODING_COMPLETED,
        GroupActionType.SEER_ITERATION_STARTED,
        GroupActionType.SEER_ITERATION_COMPLETED,
    },
    rule=_drop_started_before_completed,
)


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


_register(
    scope={
        GroupActionType.SEER_PR_CREATED,
        GroupActionType.AUTOFIX_PR_CREATED,
        GroupActionType.RESOLVED_IN_PULL_REQUEST,
    },
    rule=_drop_resolved_in_pr_near_pr_created,
)


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


_register(
    scope={
        GroupActionType.PULL_REQUEST_MERGED,
        GroupActionType.SET_RESOLVED_IN_COMMIT,
        GroupActionType.REFERENCED_IN_COMMIT,
        GroupActionType.RESOLVED_IN_PULL_REQUEST,
    },
    rule=_collapse_pr_merge_cluster,
)


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
        head_type = GroupActionType(remaining[0].type)
        rules = _rules_for(head_type)

        rewritten = False
        for rule in rules:
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

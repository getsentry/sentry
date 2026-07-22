from __future__ import annotations

from collections.abc import Sequence

from sentry.issues.action_log.peephole import ActionEntry, peephole_optimize
from sentry.issues.action_log.types import (
    AssignAction,
    AutofixPrCreatedAction,
    CommentAction,
    GroupAction,
    PullRequestMergedAction,
    ReferencedInCommitAction,
    ResolveAction,
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


class FakeEntry:
    """Lightweight stand-in for GroupActionLogEntry in tests."""

    def __init__(self, action: GroupAction) -> None:
        self.type: int = action.get_type()
        self._action = action

    @property
    def action(self) -> GroupAction:
        return self._action

    def __repr__(self) -> str:
        return type(self._action).__name__


def _action_classes(entries: Sequence[ActionEntry]) -> list[type[GroupAction]]:
    return [type(e.action) for e in entries]


def e(action: GroupAction) -> FakeEntry:
    return FakeEntry(action)


class TestPeepholeOptimize:
    def test_empty(self) -> None:
        assert peephole_optimize([]) == []

    def test_single(self) -> None:
        entry = e(CommentAction(comment_id=1, text="hi"))
        assert peephole_optimize([entry]) == [entry]

    def test_no_redundancy(self) -> None:
        entries = [
            e(AssignAction(assignee="u1")),
            e(CommentAction(comment_id=1, text="hi")),
            e(ResolveAction()),
        ]
        assert peephole_optimize(entries) == entries

    def test_pr_merge_cluster_same_pr(self) -> None:
        entries = [
            e(SetResolvedInCommitAction(commit=99)),
            e(PullRequestMergedAction(pull_request=42)),
            e(ReferencedInCommitAction(commit=98)),
            e(ResolvedInPullRequestAction(pull_request=42)),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [PullRequestMergedAction]

    def test_pr_merge_different_pr_kept(self) -> None:
        entries = [
            e(PullRequestMergedAction(pull_request=42)),
            e(ResolvedInPullRequestAction(pull_request=99)),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [PullRequestMergedAction, ResolvedInPullRequestAction]

    def test_seer_pr_created_subsumes_resolved_in_pr(self) -> None:
        entries = [
            e(SeerPRCreatedAction()),
            e(ResolvedInPullRequestAction(pull_request=42)),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [SeerPRCreatedAction]

    def test_autofix_pr_created_subsumes_resolved_in_pr(self) -> None:
        entries = [
            e(ResolvedInPullRequestAction(pull_request=42)),
            e(AutofixPrCreatedAction(pull_requests=[])),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [AutofixPrCreatedAction]

    def test_seer_rca_completed_drops_started(self) -> None:
        entries = [
            e(SeerRCACompletedAction()),
            e(SeerRCAStartedAction()),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [SeerRCACompletedAction]

    def test_seer_solution_completed_drops_started(self) -> None:
        entries = [
            e(SeerSolutionCompletedAction()),
            e(SeerSolutionStartedAction()),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [SeerSolutionCompletedAction]

    def test_seer_coding_completed_drops_started(self) -> None:
        entries = [
            e(SeerCodingCompletedAction()),
            e(SeerCodingStartedAction()),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [SeerCodingCompletedAction]

    def test_seer_iteration_completed_drops_started(self) -> None:
        entries = [
            e(SeerIterationCompletedAction()),
            e(SeerIterationStartedAction()),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [SeerIterationCompletedAction]

    def test_started_before_completed_also_dropped(self) -> None:
        entries = [
            e(SeerRCAStartedAction()),
            e(SeerRCACompletedAction()),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [SeerRCACompletedAction]

    def test_window_boundary(self) -> None:
        """Entries beyond the 4-entry window are not collapsed."""
        entries = [
            e(PullRequestMergedAction(pull_request=1)),
            e(CommentAction(comment_id=1)),
            e(CommentAction(comment_id=2)),
            e(CommentAction(comment_id=3)),
            # 5th entry — outside the 4-entry merge window
            e(ResolvedInPullRequestAction(pull_request=1)),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [
            PullRequestMergedAction,
            CommentAction,
            CommentAction,
            CommentAction,
            ResolvedInPullRequestAction,
        ]

    def test_interleaved_unrelated_preserved(self) -> None:
        """When an unrelated entry separates a pair, both are kept."""
        entries = [
            e(SeerRCACompletedAction()),
            e(AssignAction(assignee="u1")),
            e(SeerRCAStartedAction()),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [
            SeerRCACompletedAction,
            AssignAction,
            SeerRCAStartedAction,
        ]

    def test_full_seer_pipeline(self) -> None:
        """A realistic Seer autofix timeline collapses to completions + PR."""
        entries = [
            e(SeerPRCreatedAction()),
            e(ResolvedInPullRequestAction(pull_request=10)),
            e(SeerCodingCompletedAction()),
            e(SeerCodingStartedAction()),
            e(SeerSolutionCompletedAction()),
            e(SeerSolutionStartedAction()),
            e(SeerRCACompletedAction()),
            e(SeerRCAStartedAction()),
        ]
        result = peephole_optimize(entries)
        assert _action_classes(result) == [
            SeerPRCreatedAction,
            SeerCodingCompletedAction,
            SeerSolutionCompletedAction,
            SeerRCACompletedAction,
        ]

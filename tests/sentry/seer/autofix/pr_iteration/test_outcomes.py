from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import (
    AgentFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.pr_iteration.outcomes import IterationOutcome, get_iteration_outcomes
from sentry.testutils.cases import TestCase


def _patch() -> AgentFilePatch:
    return AgentFilePatch(
        repo_name="test-repo",
        diff="diff --git a/test.py b/test.py",
        patch=FilePatch(path="test.py", type="M", added=1, removed=0),
    )


def _iteration_block(index: int | None = 0, *, edited: bool = False) -> MemoryBlock:
    metadata = {"step": AutofixStep.PR_ITERATION.value, "feedback": "[]"}
    if index is not None:
        metadata["iteration_index"] = str(index)
    return MemoryBlock(
        id=f"iter-{index}",
        message=Message(role="assistant", content="", metadata=metadata),
        timestamp="2023-07-18T12:00:00Z",
        file_patches=[_patch()] if edited else None,
    )


def _plain_block(id: str, *, edited: bool = False, commit_sha: str | None = None) -> MemoryBlock:
    return MemoryBlock(
        id=id,
        message=Message(role="assistant", content=""),
        timestamp="2023-07-18T12:00:00Z",
        file_patches=[_patch()] if edited else None,
        merged_file_patches=[_patch()] if edited else None,
        pr_commit_shas={"test-repo": commit_sha} if commit_sha is not None else None,
    )


def _state(
    blocks: list[MemoryBlock],
    *,
    status: str = "completed",
    repo_pr_states: dict[str, RepoPRState] | None = None,
) -> SeerRunState:
    return SeerRunState(
        run_id=1,
        blocks=blocks,
        status=status,
        updated_at="2023-07-18T12:00:00Z",
        repo_pr_states=repo_pr_states or {},
    )


def _synced_pr_states(commit_sha: str) -> dict[str, RepoPRState]:
    return {"test-repo": RepoPRState(repo_name="test-repo", commit_sha=commit_sha)}


class TestGetIterationOutcomes(TestCase):
    def test_no_iterations(self) -> None:
        assert get_iteration_outcomes(_state([_plain_block("a")])) == {}

    def test_iteration_that_edited_nothing_made_no_changes(self) -> None:
        state = _state([_iteration_block(0), _plain_block("a")])

        assert get_iteration_outcomes(state) == {"0": IterationOutcome.NO_CHANGES}

    def test_edits_pushed_to_the_pr(self) -> None:
        state = _state(
            [_iteration_block(0), _plain_block("a", edited=True, commit_sha="abc")],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert get_iteration_outcomes(state) == {"0": IterationOutcome.CHANGES_PUSHED}

    def test_edits_that_never_reached_the_pr(self) -> None:
        state = _state(
            [_iteration_block(0), _plain_block("a", edited=True, commit_sha="stale")],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert get_iteration_outcomes(state) == {"0": IterationOutcome.PUSH_FAILED}

    def test_latest_iteration_is_in_progress_while_the_run_processes(self) -> None:
        state = _state([_iteration_block(0)], status="processing")

        assert get_iteration_outcomes(state) == {"0": IterationOutcome.IN_PROGRESS}

    def test_only_the_latest_iteration_is_in_progress(self) -> None:
        # The older iteration edited nothing and is settled; the newest is still running.
        state = _state(
            [_iteration_block(0), _iteration_block(1)],
            status="processing",
        )

        assert get_iteration_outcomes(state) == {
            "0": IterationOutcome.NO_CHANGES,
            "1": IterationOutcome.IN_PROGRESS,
        }

    def test_an_earlier_iterations_edits_do_not_count_for_a_later_one(self) -> None:
        state = _state(
            [
                _iteration_block(0),
                _plain_block("a", edited=True, commit_sha="abc"),
                _iteration_block(1),
                _plain_block("b"),
            ],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert get_iteration_outcomes(state) == {
            "0": IterationOutcome.CHANGES_PUSHED,
            "1": IterationOutcome.NO_CHANGES,
        }

    def test_edits_on_the_opening_block_count(self) -> None:
        state = _state(
            [_iteration_block(0, edited=True)],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert get_iteration_outcomes(state) == {"0": IterationOutcome.CHANGES_PUSHED}

    @patch("sentry.seer.autofix.pr_iteration.outcomes.logger")
    def test_unparseable_iterations_report_and_return_nothing(self, mock_logger: MagicMock) -> None:
        # A PR_ITERATION block without an iteration_index makes get_iterations raise.
        assert get_iteration_outcomes(_state([_iteration_block(None)])) == {}
        mock_logger.exception.assert_called_once()

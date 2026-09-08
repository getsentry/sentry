import logging
from unittest.mock import patch

from sentry.seer.agent.client_models import (
    AgentFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
    ToolResult,
)
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
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


def _tool_result(*, patches: bool) -> ToolResult:
    return ToolResult(
        tool_call_id="call-1",
        tool_call_function="execute",
        structuredContent=({"file_patches": [_patch().dict()]} if patches else {"logs": []}),
    )


def _plain_block(
    id: str,
    *,
    edited: bool = False,
    # A Code Mode edit puts its patches on a tool result instead of `file_patches`;
    # the merged view is written to the block field either way.
    code_mode_edited: bool = False,
    tool_result: ToolResult | None = None,
    commit_sha: str | None = None,
) -> MemoryBlock:
    if code_mode_edited:
        tool_result = _tool_result(patches=True)
    return MemoryBlock(
        id=id,
        message=Message(role="assistant", content=""),
        timestamp="2023-07-18T12:00:00Z",
        file_patches=[_patch()] if edited else None,
        merged_file_patches=[_patch()] if edited or code_mode_edited else None,
        pr_commit_shas={"test-repo": commit_sha} if commit_sha is not None else None,
        tool_results=[tool_result] if tool_result is not None else None,
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
    def setUp(self) -> None:
        super().setUp()
        self.log_ctx = PrIterationLogContext(logging.getLogger(__name__))

    def _outcomes(self, state: SeerRunState) -> dict[str, str]:
        return get_iteration_outcomes(state, log_ctx=self.log_ctx)

    def test_no_iterations(self) -> None:
        assert self._outcomes(_state([_plain_block("a")])) == {}

    def test_iteration_that_edited_nothing_made_no_changes(self) -> None:
        state = _state([_iteration_block(0), _plain_block("a")])

        assert self._outcomes(state) == {"0": IterationOutcome.NO_CHANGES}

    def test_edits_pushed_to_the_pr(self) -> None:
        state = _state(
            [_iteration_block(0), _plain_block("a", edited=True, commit_sha="abc")],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert self._outcomes(state) == {"0": IterationOutcome.CHANGES_PUSHED}

    def test_code_mode_edits_pushed_to_the_pr(self) -> None:
        state = _state(
            [_iteration_block(0), _plain_block("a", code_mode_edited=True, commit_sha="abc")],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert self._outcomes(state) == {"0": IterationOutcome.CHANGES_PUSHED}

    def test_a_tool_result_without_patches_is_not_an_edit(self) -> None:
        state = _state(
            [_iteration_block(0), _plain_block("a", tool_result=_tool_result(patches=False))]
        )

        assert self._outcomes(state) == {"0": IterationOutcome.NO_CHANGES}

    def test_edits_that_never_reached_the_pr(self) -> None:
        state = _state(
            [_iteration_block(0), _plain_block("a", edited=True, commit_sha="stale")],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert self._outcomes(state) == {"0": IterationOutcome.PUSH_FAILED}

    def test_latest_iteration_is_in_progress_while_the_run_processes(self) -> None:
        state = _state([_iteration_block(0)], status="processing")

        assert self._outcomes(state) == {"0": IterationOutcome.IN_PROGRESS}

    def test_only_the_latest_iteration_is_in_progress(self) -> None:
        # The older iteration edited nothing, and the newest one still runs.
        state = _state(
            [_iteration_block(0), _iteration_block(1)],
            status="processing",
        )

        assert self._outcomes(state) == {
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

        assert self._outcomes(state) == {
            "0": IterationOutcome.CHANGES_PUSHED,
            "1": IterationOutcome.NO_CHANGES,
        }

    def test_edits_on_the_opening_block_count(self) -> None:
        state = _state(
            [_iteration_block(0, edited=True)],
            repo_pr_states=_synced_pr_states("abc"),
        )

        assert self._outcomes(state) == {"0": IterationOutcome.CHANGES_PUSHED}

    def test_unparseable_iterations_report_and_return_nothing(self) -> None:
        # `get_iterations` raises when a PR_ITERATION block has no iteration_index.
        with patch.object(self.log_ctx, "error") as mock_error:
            assert self._outcomes(_state([_iteration_block(None)])) == {}

        assert mock_error.call_args.args == ("autofix.pr_iteration.iteration_outcomes.failed",)

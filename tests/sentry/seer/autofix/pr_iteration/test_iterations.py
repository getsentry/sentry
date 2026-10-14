from unittest.mock import MagicMock, patch

import pytest

from sentry.seer.agent.client_models import MemoryBlock, Message, SeerRunState
from sentry.seer.autofix.pr_iteration.errors import PrIterationError
from sentry.seer.autofix.pr_iteration.iterations import (
    get_iteration_for_insert_index,
    get_iterations,
    get_latest_iteration_index,
)
from sentry.seer.autofix.steps import AutofixStep
from sentry.testutils.cases import TestCase


def _iteration_block(iteration_index: int | None = None) -> MemoryBlock:
    metadata: dict[str, str] = {"step": AutofixStep.PR_ITERATION.value}
    if iteration_index is not None:
        metadata["iteration_index"] = str(iteration_index)
    return MemoryBlock(
        id=f"block-{iteration_index}",
        message=Message(role="assistant", content="iteration", metadata=metadata),
        timestamp="2024-01-01T00:00:00Z",
    )


def _plain_block(id: str, role: str = "assistant") -> MemoryBlock:
    return MemoryBlock(
        id=id,
        message=Message(role=role, content="content"),
        timestamp="2024-01-01T00:00:00Z",
    )


def _state_with_blocks(blocks: list[MemoryBlock]) -> SeerRunState:
    return SeerRunState(
        run_id=67890,
        blocks=blocks,
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
    )


class TestIterationHelpers(TestCase):
    def test_get_iterations_returns_empty_without_iterations(self) -> None:
        state = _state_with_blocks([])
        assert get_iterations(state) == []

    def test_get_iterations_returns_index_and_start_index(self) -> None:
        state = _state_with_blocks(
            [
                MemoryBlock(
                    id="block-0",
                    message=Message(role="assistant", content="not iteration"),
                    timestamp="2024-01-01T00:00:00Z",
                ),
                _iteration_block(1),
                _iteration_block(2),
            ]
        )

        iterations = get_iterations(state)

        assert [(it.index, it.start_index) for it in iterations] == [(1, 1), (2, 2)]

    def test_get_iterations_captures_following_blocks(self) -> None:
        state = _state_with_blocks(
            [
                _plain_block("before"),
                _iteration_block(1),
                _plain_block("a1"),
                _plain_block("a2"),
                _iteration_block(2),
                _plain_block("b1"),
            ]
        )

        iterations = get_iterations(state)

        assert [it.index for it in iterations] == [1, 2]
        assert [[b.id for b in it.blocks] for it in iterations] == [
            ["block-1", "a1", "a2"],
            ["block-2", "b1"],
        ]

    def test_get_iterations_missing_iteration_index_raises(self) -> None:
        state = _state_with_blocks([_iteration_block()])
        with pytest.raises(AssertionError):
            get_iterations(state)

    @patch("sentry.seer.autofix.pr_iteration.iterations.sentry_sdk.capture_exception")
    def test_get_iterations_missing_feedback_reports_without_raising(
        self, mock_capture: MagicMock
    ) -> None:
        # _iteration_block intentionally omits feedback metadata.
        state = _state_with_blocks([_iteration_block(1)])

        iterations = get_iterations(state)

        assert [it.index for it in iterations] == [1]
        mock_capture.assert_called_once()
        reported = mock_capture.call_args.args[0]
        assert isinstance(reported, PrIterationError)
        assert str(reported) == "PR_ITERATION block missing feedback metadata"
        assert reported.__traceback__ is not None
        assert mock_capture.call_args.kwargs["level"] == "warning"
        assert mock_capture.call_args.kwargs["extras"]["run_id"] == 67890
        assert mock_capture.call_args.kwargs["extras"]["iteration_index"] == "1"

    def test_get_latest_iteration_index_returns_zero_without_iterations(self) -> None:
        state = _state_with_blocks([])
        assert get_latest_iteration_index(state) == 0

    def test_get_latest_iteration_index_returns_most_recent(self) -> None:
        state = _state_with_blocks([_iteration_block(1), _iteration_block(2)])
        assert get_latest_iteration_index(state) == 2

    def test_get_iteration_for_insert_index(self) -> None:
        state = _state_with_blocks([_iteration_block(1), _iteration_block(2)])
        assert get_iteration_for_insert_index(state, 1) == 2

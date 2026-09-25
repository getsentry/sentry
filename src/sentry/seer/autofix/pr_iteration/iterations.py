"""The PR iterations of an Autofix run.

A run's memory is a flat list of blocks. Each PR iteration starts with a
PR_ITERATION block, and every block after it belongs to that iteration until the
next PR_ITERATION block. The helpers here split a run's blocks into those
iterations and answer questions about them, such as which iteration is the
latest and which repositories an iteration changed.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import sentry_sdk

from sentry.seer.agent.client_models import MemoryBlock, SeerRunState
from sentry.seer.autofix.pr_iteration.errors import raised_pr_iteration_error
from sentry.seer.autofix.steps import AutofixStep

logger = logging.getLogger(__name__)


class PrIterationNoPullRequestException(Exception):
    pass


@dataclass(frozen=True)
class Iteration:
    index: int
    start_index: int
    blocks: list[MemoryBlock]


def get_iterations(state: SeerRunState) -> list[Iteration]:
    """PR iterations in order, each holding its own blocks. A PR_ITERATION block
    opens an iteration; every following block belongs to it until the next
    PR_ITERATION block."""
    iterations: list[Iteration] = []
    for i, block in enumerate(state.blocks):
        metadata = block.message.metadata or {}

        if metadata.get("step") == AutofixStep.PR_ITERATION.value:
            iter_idx = metadata.get("iteration_index")
            assert iter_idx is not None, "PR_ITERATION block missing iteration_index"

            # PR_ITERATION is always started with feedback today (UI + consume
            # queue). Missing metadata is unexpected; report but keep going.
            raw_feedback = metadata.get("feedback")
            if not raw_feedback or (isinstance(raw_feedback, str) and not raw_feedback.strip()):
                sentry_sdk.capture_exception(
                    raised_pr_iteration_error("PR_ITERATION block missing feedback metadata"),
                    level="warning",
                    extras={
                        "run_id": state.run_id,
                        "block_index": i,
                        "iteration_index": iter_idx,
                        "block_id": block.id,
                    },
                )

            iterations.append(Iteration(index=int(iter_idx), start_index=i, blocks=[block]))
        elif iterations:
            iterations[-1].blocks.append(block)

    return iterations


def iteration_repos(iteration: Iteration) -> set[str]:
    """The repositories this iteration changed."""
    return {
        patch.repo_name for block in iteration.blocks for patch in (block.merged_file_patches or [])
    }


def get_latest_iteration_index(state: SeerRunState) -> int:
    try:
        iterations = get_iterations(state)
    except Exception:
        logger.exception("autofix.get_latest_iteration_index.failed")
        return 0
    return iterations[-1].index if iterations else 0


def get_iteration_for_insert_index(state: SeerRunState, insert_index: int) -> int:
    block = state.blocks[insert_index]
    metadata = block.message.metadata or {}
    return int(metadata["iteration_index"])

from __future__ import annotations

from sentry.investigations.converters.autofix import convert_autofix_run
from sentry.investigations.converters.notebook import IssueRef
from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.seer.agent.client_models import (
    AgentFilePatch,
    Artifact,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)

ISSUE = IssueRef(group_id=10, short_id="STOREFRONT-1A2", title="TypeError: unsupported operand")

ROOT_CAUSE = {
    "headline": "Checkout crashes when cart has a deleted product",
    "one_line_description": "get_total reads price from soft-deleted products.",
    "five_whys": ["Checkout raises TypeError", "A line item's price is None"],
    "reproduction_steps": ["Add product to cart", "Delete product", "Check out"],
    "relevant_repo": "acme/storefront",
    "fixability": {"assessment": "fixable", "reason": "Localized change."},
}
SOLUTION = {
    "one_line_summary": "Skip deleted products when summing.",
    "steps": [{"title": "Filter deleted", "description": "Skip items without a price."}],
}


def _block(
    *artifacts: Artifact, patches: list[AgentFilePatch] | None = None, block_id: str = "b"
) -> MemoryBlock:
    return MemoryBlock(
        id=block_id,
        message=Message(role="assistant", content="c"),
        timestamp="2026-10-28T00:00:00Z",
        artifacts=list(artifacts),
        merged_file_patches=patches,
    )


def _state(
    blocks: list[MemoryBlock], repo_pr_states: dict[str, RepoPRState] | None = None
) -> SeerRunState:
    return SeerRunState(
        run_id=42,
        blocks=blocks,
        status="completed",
        updated_at="2026-10-28T00:00:00Z",
        repo_pr_states=repo_pr_states or {},
    )


def test_root_cause_only() -> None:
    state = _state([_block(Artifact(key="root_cause", data=ROOT_CAUSE, reason="r"))])

    notebook = convert_autofix_run(state=state, issue=ISSUE)

    assert notebook.source_type == InvestigationSourceType.AUTOFIX
    assert notebook.source_key == "autofix:42"
    assert notebook.title == ROOT_CAUSE["headline"]
    assert notebook.source == {
        "type": InvestigationSourceType.AUTOFIX,
        "seerRunId": 42,
        "groupId": 10,
        "shortId": "STOREFRONT-1A2",
    }
    assert [(b.key, b.kind, b.config) for b in notebook.blocks] == [
        ("root_cause", InvestigationBlockKind.ROOT_CAUSE, ROOT_CAUSE)
    ]


def test_full_run() -> None:
    patch = AgentFilePatch(
        repo_name="acme/storefront",
        patch=FilePatch(path="cart.py", type="M", added=2, removed=1),
        diff="@@ -1 +1,2 @@",
    )
    state = _state(
        [
            _block(Artifact(key="root_cause", data=ROOT_CAUSE, reason="r"), block_id="1"),
            _block(Artifact(key="solution", data=SOLUTION, reason="r"), block_id="2"),
            _block(patches=[patch], block_id="3"),
        ],
        repo_pr_states={
            "acme/storefront": RepoPRState(
                repo_name="acme/storefront",
                pr_number=7,
                pr_url="https://github.com/acme/storefront/pull/7",
                pr_creation_status="completed",
            ),
            "acme/failed": RepoPRState(repo_name="acme/failed", pr_creation_status="error"),
        },
    )

    notebook = convert_autofix_run(state=state, issue=ISSUE)

    assert [b.key for b in notebook.blocks] == [
        "root_cause",
        "solution",
        "code_changes:acme/storefront",
        "pull_request:acme/storefront",
    ]
    assert notebook.blocks[1].config == SOLUTION
    assert notebook.blocks[2].config == {
        "repo_name": "acme/storefront",
        "patches": [patch.dict()],
    }
    assert notebook.blocks[3].config == {
        "seer_run_id": 42,
        "repo_name": "acme/storefront",
        "pr_number": 7,
        "pr_url": "https://github.com/acme/storefront/pull/7",
    }


def test_falls_back_to_issue_title_before_root_cause() -> None:
    notebook = convert_autofix_run(state=_state([_block()]), issue=ISSUE)

    assert notebook.title == ISSUE.title
    assert notebook.blocks == []

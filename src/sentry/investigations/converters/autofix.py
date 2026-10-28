from __future__ import annotations

from sentry.investigations.converters.notebook import BlockSpec, ConvertedNotebook, IssueRef
from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.seer.agent.client_models import SeerRunState


def convert_autofix_run(*, state: SeerRunState, issue: IssueRef) -> ConvertedNotebook:
    """One notebook per Autofix run. Artifacts are stored as Seer wrote them."""
    artifacts = state.get_artifacts()
    blocks: list[BlockSpec] = []

    root_cause = artifacts.get("root_cause")
    if root_cause is not None and root_cause.data is not None:
        blocks.append(
            BlockSpec(
                "root_cause", InvestigationBlockKind.ROOT_CAUSE, "Root cause", root_cause.data
            )
        )

    solution = artifacts.get("solution")
    if solution is not None and solution.data is not None:
        blocks.append(BlockSpec("solution", InvestigationBlockKind.SOLUTION, "Plan", solution.data))

    for repo_name, patches in state.get_diffs_by_repo().items():
        blocks.append(
            BlockSpec(
                f"code_changes:{repo_name}",
                InvestigationBlockKind.CODE_CHANGES,
                f"Code changes in {repo_name}",
                {"repo_name": repo_name, "patches": [patch.dict() for patch in patches]},
            )
        )

    # PR status changes after the run, so the block points at the run and PR
    # instead of copying a state that would go stale.
    for pr_state in state.get_created_pull_request_states():
        blocks.append(
            BlockSpec(
                f"pull_request:{pr_state.repo_name}",
                InvestigationBlockKind.PULL_REQUEST,
                f"Pull request in {pr_state.repo_name}",
                {
                    "seer_run_id": state.run_id,
                    "repo_name": pr_state.repo_name,
                    "pr_number": pr_state.pr_number,
                    "pr_url": pr_state.pr_url,
                },
            )
        )

    headline = root_cause.data.get("headline") if root_cause and root_cause.data else None
    return ConvertedNotebook(
        source_type=InvestigationSourceType.AUTOFIX,
        source_key=f"autofix:{state.run_id}",
        title=headline or issue.title,
        source={
            "type": InvestigationSourceType.AUTOFIX,
            "seerRunId": state.run_id,
            "groupId": issue.group_id,
            "shortId": issue.short_id,
        },
        blocks=blocks,
    )

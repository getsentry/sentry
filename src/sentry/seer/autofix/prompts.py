"""
Prompts for Explorer-based Autofix steps.
"""

from textwrap import dedent
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState


class PromptBuilder(Protocol):
    """Signature shared by all autofix step prompt builders."""

    def __call__(
        self,
        *,
        short_id: str,
        title: str,
        culprit: str,
        artifact_key: str | None,
        run_state: "SeerRunState | None" = None,
        should_run_repo_checks: bool = False,
    ) -> str: ...


def root_cause_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    artifact_key: str | None,
    run_state: "SeerRunState | None" = None,
    should_run_repo_checks: bool = False,
) -> str:
    raise RuntimeError("Root cause prompts must run through the Seer Autofix feature")


def solution_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    artifact_key: str | None,
    run_state: "SeerRunState | None" = None,
    should_run_repo_checks: bool = False,
) -> str:
    raise RuntimeError("Solution prompts must run through the Seer Autofix feature")


def code_changes_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    artifact_key: str | None,
    run_state: "SeerRunState | None" = None,
    should_run_repo_checks: bool = False,
) -> str:
    raise RuntimeError("Code changes prompts must run through the Seer Autofix feature")


def pr_iteration_prompt(
    *,
    short_id: str,
    title: str,
    culprit: str,
    artifact_key: str | None,
    run_state: "SeerRunState | None" = None,
    should_run_repo_checks: bool = False,
) -> str:
    prompt = dedent(
        f"""\
        Iterate on the pull request for issue {short_id}: "{title}" (culprit: {culprit})

        Review the existing pull request, previous code changes, and any available feedback. Update the codebase to address the requested revisions while preserving the original fix.

        Steps:
        1. Inspect the existing pull request and prior file patches
        2. Identify the smallest set of follow-up changes needed
        3. Use the code editing tools to revise the implementation

        Use your coding tools to make changes directly to the codebase.
        """
    )

    pr_links = pr_links_section(run_state)
    if pr_links:
        prompt = f"{prompt}\n{pr_links}"

    return prompt


def pr_links_section(run_state: "SeerRunState | None") -> str:
    """Render a section linking the open pull request URLs for the run, if any."""
    if run_state is None:
        return ""

    lines = [
        f"- {pr.repo_name}: {pr.pr_url}" for pr in run_state.repo_pr_states.values() if pr.pr_url
    ]
    if not lines:
        return ""

    header = (
        "We've created/updated the following pull request(s) as a result of your changes. "
        "Review each one — including its description, diff, and review comments — "
        "before making further changes:"
    )
    return "\n".join([header, *lines])


def artifact_tool_str(artifact_key: str | None) -> str:
    if not artifact_key:
        return "with"
    return f"by calling the `artifact_write_{artifact_key}` tool with"

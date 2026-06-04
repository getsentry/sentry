"""
Prompts for Explorer-based Autofix steps.
"""

from textwrap import dedent


def root_cause_prompt(*, short_id: str, title: str, culprit: str, artifact_key: str | None) -> str:
    return dedent(
        f"""\
        Analyze issue {short_id}: "{title}" (culprit: {culprit})

        Your task is to find the ROOT CAUSE of this issue. Do not propose fixes - only identify why the error is happening.

        Guidelines:
        1. Use your tools to fetch the issue details and examine the evidence
        2. Investigate the trace, replay, logs, other issues, trends, and other telemetry when available to gain a deeper understanding of the issue
        3. Investigate the relevant code in the codebase
        4. Ask "why" repeatedly to find the TRUE root cause (not just symptoms)
        5. Use your todo list to track multiple hypotheses for complex bugs

        If you have previously generated this artifact, disregard the prior attempt and produce a completely new one from scratch.

        When you have enough information, always generate the root_cause artifact {artifact_tool_str(artifact_key)}:
        - one_line_description: A concise summary under 30 words
        - five_whys: Chain of brief "why" statements leading to the root cause. (do not write the questions, only the answers; e.g. prefer "x -> y -> z", NOT "x -> why x? y -> why y? z")
        - reproduction_steps: Steps that would reproduce this issue, each under 15 words.
        - relevant_repo: The full repository name (e.g. "owner/repo") where the fix should be made. Pick the one repo most directly responsible for the root cause.
        """
    )


def solution_prompt(*, short_id: str, title: str, culprit: str, artifact_key: str | None) -> str:
    return dedent(
        f"""\
        Plan a solution for issue {short_id}: "{title}" (culprit: {culprit})

        Based on the root cause analysis, design a solution to fix this issue.

        Steps:
        1. Review the root cause that was identified
        2. Explore the codebase to understand the affected areas
        3. Consider different possible approaches and pick the single most pragmatic one.

        Do NOT include testing as part of your plan.

        If you have previously generated this artifact, disregard the prior attempt and produce a completely new one from scratch.

        When you have a solid plan, always generate the solution artifact {artifact_tool_str(artifact_key)}:
        - one_line_summary: A concise summary of the fix in under 30 words
        - steps: Ordered list of steps to implement the solution, each with:
          - title: Short name for the step
          - description: What needs to be done

        Do NOT implement the solution - only plan it.
        """
    )


def code_changes_prompt(
    *, short_id: str, title: str, culprit: str, artifact_key: str | None
) -> str:
    return dedent(
        f"""\
        Implement the fix for issue {short_id}: "{title}" (culprit: {culprit})

        Based on the root cause and solution plan, implement the actual code changes.

        Steps:
        1. Review the root cause and solution plan from the previous analysis
        2. Use the code editing tools to make the necessary changes
        3. Ensure changes are minimal and focused on fixing the issue

        If code changes were previously made, disregard them and implement the fix again from scratch.

        Use your coding tools to make changes directly to the codebase.
        """
    )


def artifact_tool_str(artifact_key: str | None) -> str:
    if not artifact_key:
        return "with"
    return f"by calling the `artifact_write_{artifact_key}` tool with"

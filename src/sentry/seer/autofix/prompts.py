"""
Prompts for Explorer-based Autofix steps.
"""

from textwrap import dedent


def root_cause_prompt(*, short_id: str, title: str, culprit: str) -> str:
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

        When you have enough information, generate the root_cause artifact with:
        - one_line_description: A concise summary under 30 words
        - five_whys: Chain of brief "why" statements leading to the root cause. (do not write the questions, only the answers; e.g. prefer "x -> y -> z", NOT "x -> why x? y -> why y? z")
        - reproduction_steps: Steps that would reproduce this issue, each under 15 words.
        """
    )


def solution_prompt(*, short_id: str, title: str, culprit: str) -> str:
    return dedent(
        f"""\
        Plan a solution for issue {short_id}: "{title}" (culprit: {culprit})

        Based on the root cause analysis, design a solution to fix this issue.

        Steps:
        1. Review the root cause that was identified
        2. Explore the codebase to understand the affected areas
        3. Consider different possible approaches and pick the single most pragmatic one.

        Do NOT include testing as part of your plan.

        When you have a solid plan, generate the solution artifact with:
        - one_line_summary: A concise summary of the fix in under 30 words
        - steps: Ordered list of steps to implement the solution, each with:
          - title: Short name for the step
          - description: What needs to be done

        Do NOT implement the solution - only plan it.
        """
    )


def code_changes_prompt(*, short_id: str, title: str, culprit: str) -> str:
    return dedent(
        f"""\
        Implement the fix for issue {short_id}: "{title}" (culprit: {culprit})

        Based on the root cause and solution plan, implement the actual code changes.

        Steps:
        1. Review the root cause and solution plan from the previous analysis
        2. Use the code editing tools to make the necessary changes
        3. Ensure changes are minimal and focused on fixing the issue

        Use your coding tools to make changes directly to the codebase.
        """
    )


def impact_assessment_prompt(*, short_id: str, title: str, culprit: str) -> str:
    return dedent(
        f"""\
        Assess the impact of issue {short_id}: "{title}" (culprit: {culprit})

        Analyze how this issue affects the system, users, and business.

        Steps:
        1. Fetch the issue details to understand the error and its frequency
        2. Understand upstream and downstream dependencies
        3. Check for relevant metrics, performance data, and connected issues
        4. Consider affected functionality, user-facing impact, data integrity, and system stability

        When you have assessed the impact, generate the impact_assessment artifact with:
        - one_line_description: A concise summary of the overall impact in under 30 words
        - impacts: List of specific impacts, each with:
          - label: What is impacted (e.g., "User Authentication", "Payment Flow")
          - rating: Severity of the impact. High is an urgent incident, medium is a significant but non-urgent problem, low is a minor issue or no impact at all.
          - impact_description: One line describing the impact
          - evidence: Evidence or reasoning for this assessment
        """
    )


def triage_prompt(*, short_id: str, title: str, culprit: str) -> str:
    return dedent(
        f"""\
        Triage issue {short_id}: "{title}" (culprit: {culprit})

        Help triage this issue by identifying potential suspects and assignees.

        Steps:
        1. Consider the issue details, the relevant telemetry, impacted systems, and the root cause of the issue
        2. Look at recent commits that touched the problematic systems (use git history if available)
        3. Identify who might have introduced the issue or at least who owns the affected code
        4. Consider code ownership patterns in the repository

        When you have enough information, generate the triage artifact with:
        - suspect_commit: If you can identify a likely culprit commit:
          - sha: The git commit SHA (7 characters)
          - repo_name: Full repository name (e.g. 'getsentry/sentry')
          - message: The commit message/title
          - author_name: Name of the commit author
          - author_email: Email of the commit author
          - committed_date: When the commit was made (YYYY-MM-DD format)
          - description: Why this commit is suspected of causing the issue
        - suggested_assignee: If you can identify who should fix this:
          - name: Name of the suggested assignee
          - email: Email of the suggested assignee
          - why: Reason for suggesting this person

        Either field can be omitted if you cannot determine it with reasonable confidence.
        """
    )

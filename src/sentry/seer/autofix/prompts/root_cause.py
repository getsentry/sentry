"""Root cause analysis prompt for Explorer-based Autofix."""

ROOT_CAUSE_PROMPT = """Analyze issue {short_id}: "{title}" (culprit: {culprit})

Your task is to find the ROOT CAUSE of this issue. Do not propose fixes - only identify why the error is happening.

Guidelines:
1. Use your tools to fetch the issue details and examine the evidence
2. Investigate the trace, replay, logs, other issues, trends, and other telemetry when available to gain a deeper understanding of the issue
3. Investigate the relevant code in the codebase
4. Ask "why" repeatedly to find the TRUE root cause (not just symptoms)
5. Use your todo list to track multiple hypotheses for complex bugs

When you have enough information, generate the root_cause artifact with:
- one_line_description: A concise summary under 30 words
- five_whys: Chain of "why" statements leading to the root cause.
- reproduction_steps: Steps that would reproduce this issue
"""

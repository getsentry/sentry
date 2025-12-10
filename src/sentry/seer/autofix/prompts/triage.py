TRIAGE_PROMPT = """Triage issue {short_id}: "{title}" (culprit: {culprit})

Help triage this issue by identifying potential suspects and assignees.

Steps:
1. Consider the issue details, the relevant telemetry, impacted systems, and the root cause of the issue
2. Look at recent commits that touched the problematic systems (use git history if available)
3. Identify who might have introduced the issue or at least who owns the affected code
4. Consider code ownership patterns in the repository

When you have enough information, generate the triage artifact with:
- suspect_commit: If you can identify a likely culprit commit:
  - sha: The git commit SHA
  - description: Why this commit is suspected
- suggested_assignee: If you can identify who should fix this:
  - name: Name of the suggested assignee
  - email: Email of the suggested assignee
  - why: Reason for suggesting this person

Either field can be omitted if you cannot determine it with reasonable confidence.
"""

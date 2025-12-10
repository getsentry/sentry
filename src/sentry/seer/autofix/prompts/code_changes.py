CODE_CHANGES_PROMPT = """Implement the fix for issue {short_id}: "{title}" (culprit: {culprit})

Based on the root cause and solution plan, implement the actual code changes.

Steps:
1. Review the root cause and solution plan from the previous analysis
2. Use the code editing tools to make the necessary changes
3. Ensure changes are minimal and focused on fixing the issue

Use your coding tools to make changes directly to the codebase.
"""

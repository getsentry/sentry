SOLUTION_PROMPT = """Plan a solution for issue {short_id}: "{title}" (culprit: {culprit})

Based on the root cause analysis, design a solution to fix this issue.

Steps:
1. Review the root cause that was identified
2. Explore the codebase to understand the affected areas
3. Design a clear, step-by-step solution plan

When you have a solid plan, generate the solution artifact with:
- one_line_summary: A concise summary of the fix in under 30 words
- steps: Ordered list of steps to implement the solution, each with:
  - title: Short name for the step
  - description: What needs to be done

Do NOT implement the solution - only plan it.
"""

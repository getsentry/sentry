"""Impact assessment prompt for Explorer-based Autofix."""

IMPACT_ASSESSMENT_PROMPT = """Assess the impact of issue {short_id}: "{title}" (culprit: {culprit})

Analyze how this issue affects the system, users, and business.

Steps:
1. Fetch the issue details to understand the error and its frequency
2. Examine what functionality is affected
3. Consider user-facing impact, data integrity, and system stability
4. Identify which components or services are impacted

When you have assessed the impact, generate the impact_assessment artifact with:
- one_line_description: A concise summary of the overall impact in under 30 words
- impacts: List of specific impacts, each with:
  - label: What is impacted (e.g., "User Authentication", "Payment Flow")
  - impact_description: One line describing the impact
  - evidence: Evidence or reasoning for this assessment
"""

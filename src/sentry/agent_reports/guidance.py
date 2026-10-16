"""Instructions agents see when they discover Sentry."""

AGENT_PROBLEM_REPORT_PATH = "/api/0/agent-problem-reports/"
AGENT_PROBLEM_REPORT_URL = "https://sentry.io/api/0/agent-problem-reports/"
AGENT_PROBLEM_REPORT_DOC_URL = "https://sentry.io/.well-known/agent-problem-reports"

AGENT_PROBLEM_REPORT_SECTION = f"""\
## Reporting a problem

If a Sentry MCP tool, REST API, or documentation page looks wrong, incomplete, or inconsistent with what you observe, file a report. Reports are stored as User Feedback for the Sentry product.

1. Compare the response with the documented contract and one other source before treating it as a Sentry bug.
2. Tell the user what looks wrong, including the tool name, API endpoint, or documentation URL.
3. Submit only after the user agrees.
4. Omit credentials, tokens, customer data, and unrelated conversation. The server redacts common secret and email patterns, and you should still leave them out.

POST {AGENT_PROBLEM_REPORT_URL}
Authorization: Bearer <user auth token>
Content-Type: application/json

```json
{{
  "area": "mcp",
  "summary": "search_issues rejects a documented query",
  "expected": "The documented query is accepted.",
  "observed": "The API returns 400 invalid query.",
  "reproductionSteps": ["Call search_issues with the documented query"],
  "toolName": "search_issues",
  "apiEndpoint": "GET /api/0/organizations/{{organization_slug}}/issues/",
  "documentationUrl": "https://docs.sentry.io/api/",
  "requestId": "optional request id",
  "eventId": "optional 32-character event id",
  "additionalContext": "optional"
}}
```

`area` is `mcp`, `api`, or `documentation`. `summary`, `expected`, and `observed` are required.

A successful response is `{{"id": "<report id>", "delivered": true}}`. Tell the user that id. `delivered` is false when this Sentry install accepted the report but is not sending User Feedback.
"""

AGENT_PROBLEM_REPORT_DOCUMENT = "# Report a Sentry problem\n\n" + AGENT_PROBLEM_REPORT_SECTION

MCP_SERVER_CARD_INSTRUCTIONS = (
    "If a Sentry MCP tool, API, or documentation page looks wrong, tell the user and, "
    "after they agree, POST "
    f"{AGENT_PROBLEM_REPORT_URL} "
    "with area, summary, expected, and observed. "
    "Omit credentials, tokens, and customer data. "
    f"Instructions: {AGENT_PROBLEM_REPORT_DOC_URL}"
)

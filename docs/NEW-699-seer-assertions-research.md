# NEW-699: Seer-Powered Assertion Suggestions - Research

## Ticket Summary

**Linear Issue**: [NEW-699](https://linear.app/getsentry/issue/NEW-699/use-seers-generic-llm-capabilities-to-generate-suggested-assertions)

**Goal**: After a user fires a test monitor, use Seer's LLM capabilities to suggest assertions based on the HTTP response. Ideally, validate each suggestion by running it back through as another test.

**Related**: [NEW-683](https://linear.app/getsentry/issue/NEW-683/add-test-monitor-to-the-uptime-monitor-configuration) - Add "test monitor" to uptime monitor configuration

**Status**: Planned
**Project**: Uptime Response Assertions
**Team**: New Products

---

## Recommended Approach: Seer Explorer Client

Based on Sentry's "How to Build with AI" guidelines, this feature is a perfect fit for the **Seer Explorer Client** - the recommended approach for most LLM-powered features.

### Why This Approach

- No code needed in `getsentry/seer` repo
- Minimal code in `getsentry/sentry`
- Supports structured artifacts (Pydantic models) for typed assertion suggestions
- Can run synchronously to validate suggestions
- Built-in tools already available; custom tools likely unnecessary

### Implementation Pattern

```python
from sentry.seer.explorer.client import SeerExplorerClient
from pydantic import BaseModel

# Define structured output for assertions
class SuggestedAssertion(BaseModel):
    assertion_type: str  # e.g., "status_code", "response_time", "body_contains"
    operator: str        # e.g., "equals", "less_than", "contains"
    value: str
    confidence: float
    explanation: str

class AssertionSuggestions(BaseModel):
    suggestions: list[SuggestedAssertion]

# Use the client
client = SeerExplorerClient(organization, user)
run_id = client.start_run(
    f"Analyze this HTTP response and suggest monitoring assertions: {response_data}",
    artifact_key="assertions",
    artifact_schema=AssertionSuggestions
)
state = client.get_run(run_id, blocking=True)
suggestions = state.get_artifact("assertions", AssertionSuggestions)
```

---

## Local Development Setup

### Prerequisites

1. **Clone the Seer repo**: https://github.com/getsentry/seer
2. **Vertex AI access**: Required for LLM calls. You should have access to the `ml-ai` GCP project by default. If not, ask in `#discuss-seer-infra`.

### Sentry Configuration

Sentry is already configured to connect to local Seer at `http://127.0.0.1:9091`:

```python
# src/sentry/conf/server.py
SEER_DEFAULT_URL = "http://127.0.0.1:9091"  # for local development
SEER_AUTOFIX_URL = SEER_DEFAULT_URL
SEER_SUMMARIZATION_URL = SEER_DEFAULT_URL
# ... all Seer URLs point to localhost:9091
```

### Steps

1. Clone Seer: `git clone git@github.com:getsentry/seer.git`
2. Follow the Seer README for setup
3. Run Seer locally (starts on port 9091)
4. Local Sentry will automatically connect

---

## Key Resources

### Slack Channels

- `#discuss-seer-infra` - General Seer questions
- `#proj-seer-explorer` - Explorer-specific questions, feature requests
- `#discuss-ai` - Broader AI discussions

### Code References

**Seer Explorer Client**:

- Client: `src/sentry/seer/explorer/client.py`
- Models: `src/sentry/seer/explorer/client_models.py`
- Custom tools: `src/sentry/seer/explorer/custom_tool_utils.py`

**Seer Tools (in getsentry/seer)**:

- Built-in tools: https://github.com/getsentry/seer/blob/main/src/seer/automation/explorer/tools/explorer_tools.py

### Documentation

- How to Build with AI @ Sentry: https://www.notion.so/sentry/How-to-Build-with-AI-Sentry-2118b10e4b5d80a38064f4792c5a8d9f
- Seer repo: https://github.com/getsentry/seer

---

## Feature Capabilities Available

| Capability                   | Available | Notes                       |
| ---------------------------- | --------- | --------------------------- |
| LLM text generation          | Yes       | Via Seer Explorer Client    |
| Structured output (Pydantic) | Yes       | Artifact schemas            |
| Custom tools                 | Yes       | But try built-in first      |
| Sync/async execution         | Yes       | `blocking=True` or poll     |
| On-completion hooks          | Yes       | For async workflows         |
| Intelligence levels          | Yes       | "low", "medium", "high"     |
| Code editing/PRs             | Yes       | Not needed for this feature |

---

## Next Steps

1. [ ] Set up Seer repo locally
2. [ ] Verify Vertex AI access
3. [ ] Reach out in `#proj-seer-explorer` (recommended per docs, since Explorer is under active development)
4. [ ] Design the assertion suggestion prompt
5. [ ] Integrate with uptime monitor test flow (see NEW-683)

---

_Research conducted: January 2026_

# NEW-699: Seer-Powered Assertion Suggestions - Research

## Ticket Summary

**Linear Issue**: [NEW-699](https://linear.app/getsentry/issue/NEW-699/use-seers-generic-llm-capabilities-to-generate-suggested-assertions)

**Goal**: After a user fires a test monitor, use Seer's LLM capabilities to suggest assertions based on the HTTP response. Ideally, validate each suggestion by running it back through as another test.

**Related**: [NEW-683](https://linear.app/getsentry/issue/NEW-683/add-test-monitor-to-the-uptime-monitor-configuration) - Add "test monitor" to uptime monitor configuration

**Status**: In Progress (Backend + Frontend Complete, Blocked on GCP Permissions)
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

1. **Repos cloned**:
   - `~/code/sentry` - Main Sentry repo
   - `~/code/seer` - Seer AI service
   - `~/code/uptime-checker` - Uptime checker service (Rust)
2. **Vertex AI access**: Required for LLM calls. You should have access to the `ml-ai` GCP project by default. If not, ask in `#discuss-seer-infra`.
3. **GCP auth**: Run `gcloud auth application-default login` if needed.

### Step-by-Step Setup

#### Step 1: Configure Sentry

Add to `~/.sentry/sentry.conf.py`:

```python
# Uptime region config for local uptime-checker
from sentry.conf.types.uptime import UptimeRegionConfig

UPTIME_REGIONS = [
    UptimeRegionConfig(
        slug="default",
        name="Default Region",
        config_redis_cluster="default",
        api_endpoint="localhost:12345",
    ),
]

# Enable uptime features
SENTRY_FEATURES["organizations:uptime-runtime-assertions"] = True
SENTRY_FEATURES["organizations:insights-uptime"] = True
SENTRY_USE_UPTIME = True

# Seer RPC shared secret (must match Seer's .env)
SEER_RPC_SHARED_SECRET = ["seers-also-very-long-value-haha"]

# Enable AI/Seer features
SENTRY_FEATURES["organizations:gen-ai-features"] = True
SENTRY_FEATURES["organizations:gen-ai-consent"] = True
SENTRY_FEATURES["organizations:gen-ai-consent-flow-removal"] = True
SENTRY_FEATURES["organizations:trigger-autofix-on-issue-summary"] = True
SENTRY_FEATURES["organizations:seer-explorer"] = True
```

#### Step 2: Configure Seer

Create/update `~/code/seer/.env`:

```bash
DD_DOGSTATSD_DISABLE=True
GITHUB_TOKEN=<your-github-token>
NO_SENTRY_SDK=1
NO_RPC_CLIENT=0           # Enable real RPC client for Sentry integration
NO_REAL_MODELS=1
DEV=1
RPC_SHARED_SECRET="seers-also-very-long-value-haha"
APP_PORT=9091

# GCP/Vertex AI configuration (required for Seer Explorer LLM calls)
GOOGLE_CLOUD_PROJECT=ml-ai  # Or your project with Vertex AI access
```

**GCP Authentication** (required for Vertex AI):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project ml-ai  # Or your project
```

You need the "Service Usage Consumer" IAM role on the GCP project to make Vertex AI API calls.

Run Seer database migrations (first time only):

```bash
cd ~/code/seer
source .venv/bin/activate
SEER_ENVIRONMENT=local alembic upgrade head
```

#### Step 3: Start Services (in order)

**Terminal 1 - Sentry Devserver:**

```bash
cd ~/code/sentry
sentry devserver
```

Wait for devserver to fully start (watch for "Booting worker" messages).

**Terminal 2 - Seer:**

```bash
cd ~/code/seer
source .venv/bin/activate
flask run -p 9091
```

Verify with: `curl http://127.0.0.1:9091/health/live`

**Terminal 3 - Uptime Checker:**

```bash
cd ~/code/uptime-checker
cargo run -- --config config/local.toml --region default
```

Or if you have a pre-built binary:

```bash
./target/debug/uptime-checker --config config/local.toml --region default
```

The checker listens on port 12345 by default.

#### Step 4: Verify Everything Works

**Test Seer health:**

```bash
curl http://127.0.0.1:9091/health/live
curl http://127.0.0.1:9091/health/ready
```

**Test uptime-checker:**

```bash
curl http://localhost:12345/health
```

**Test Seer Explorer Client (from Sentry shell):**

```bash
cd ~/code/sentry
sentry django shell < scripts/test_seer_explorer.py
```

**Test uptime preview check (via API):**

```bash
curl -X POST "http://localhost:9000/api/0/organizations/sentry/uptime-preview-check/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-auth-token>" \
  -d '{"url": "https://httpbin.org/get", "timeout_ms": 5000}'
```

### Important Notes

⚠️ **Keep virtual environments separate!**

- Sentry uses `psycopg2-binary`
- Seer uses `psycopg3`
- Mixing them causes SQL syntax errors

If you accidentally install psycopg3 in Sentry's venv:

```bash
cd ~/code/sentry
pip uninstall psycopg psycopg-binary
```

### Service Ports Reference

| Service        | Port  | URL                    |
| -------------- | ----- | ---------------------- |
| Sentry Web     | 9000  | http://localhost:9000  |
| Seer           | 9091  | http://127.0.0.1:9091  |
| Uptime Checker | 12345 | http://localhost:12345 |
| PostgreSQL     | 5432  | (via devservices)      |
| Redis          | 6379  | (via devservices)      |

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

## Progress & Findings

### ✅ Completed Setup

1. **Seer repo running locally** - Configured at `~/code/seer`
2. **Seer Explorer Client tested** - Successfully created runs
3. **Uptime-checker running locally** - Preview check endpoint working

### ⚠️ Blocked: GCP/Vertex AI Permissions

**Issue**: Seer Explorer requires Vertex AI access via GCP, but local development is blocked by permission errors.

**Error encountered**:

```
Error code: 403 - {'error': {'code': 403, 'message': 'Permission denied on resource project ml-ai.',
'status': 'PERMISSION_DENIED', 'details': [{'@type': 'type.googleapis.com/google.rpc.ErrorInfo',
'reason': 'CONSUMER_INVALID', 'domain': 'googleapis.com',
'metadata': {'service': 'aiplatform.googleapis.com', 'containerInfo': 'ml-ai', 'consumer': 'projects/ml-ai'}}]}}
```

**Root cause**: The `CONSUMER_INVALID` error means the user's GCP application-default credentials don't have the `serviceusage.services.use` permission on the `ml-ai` project, which is required to make Vertex AI API calls.

**Required Seer configuration** (`~/code/seer/.env`):

```bash
# GCP/Vertex AI configuration for Seer Explorer LLM calls
GOOGLE_CLOUD_PROJECT=ml-ai  # Or another project with Vertex AI enabled
```

**To resolve**:

1. Request "Service Usage Consumer" IAM role on `ml-ai` project, OR
2. Use a different GCP project where you have Vertex AI access
3. Run `gcloud auth application-default login` with correct account
4. Run `gcloud auth application-default set-quota-project <project-id>`

**Note**: Being able to see a project in GCP Console doesn't mean your local ADC credentials have API access. The IAM permissions are separate.

### Local Dev Configuration

**Sentry config** (`~/.sentry/sentry.conf.py`):

```python
# Seer Config
SEER_RPC_SHARED_SECRET = ["seers-also-very-long-value-haha"]

# Enable AI features for local development
SENTRY_FEATURES["organizations:gen-ai-features"] = True
SENTRY_FEATURES["organizations:gen-ai-consent"] = True
SENTRY_FEATURES["organizations:gen-ai-consent-flow-removal"] = True  # Skip consent prompts
SENTRY_FEATURES["organizations:trigger-autofix-on-issue-summary"] = True
SENTRY_FEATURES["organizations:seer-explorer"] = True  # Enable Seer Explorer client
```

**Seer config** (`~/code/seer/.env`):

```bash
DD_DOGSTATSD_DISABLE=True
GITHUB_TOKEN=<your-token>
NO_SENTRY_SDK=1
NO_RPC_CLIENT=0           # Enable real RPC client for Sentry integration
NO_REAL_MODELS=1
DEV=1
RPC_SHARED_SECRET="seers-also-very-long-value-haha"
APP_PORT=9091

# GCP/Vertex AI configuration (required for Seer Explorer LLM calls)
GOOGLE_CLOUD_PROJECT=ml-ai  # Or your project with Vertex AI access
```

**Important**: Keep Sentry and Seer in separate virtual environments. Seer uses `psycopg3` while Sentry uses `psycopg2-binary` - mixing them causes SQL syntax errors.

---

## ✅ Resolved: Response Body Now Available

### The Problem (Resolved)

The uptime preview check endpoint (`/api/0/organizations/{org}/uptime-preview-check/`) was NOT returning the HTTP response body, which is **required** for generating assertion suggestions.

### Root Cause

The uptime-checker's response capture feature (commit `3d81311`) was designed specifically for **failure debugging**:

**File**: `uptime-checker/src/checker/reqwest_checker.rs`

```rust
// Line 488-489: Response capture is conditional
let should_capture = self.response_capture_enabled && check.get_config().capture_response_on_failure;

// Line 559: Only attaches body on FAILURE
if should_capture && check_result.result == CheckStatus::Failure {
    if let Some(last_req) = rinfos.last_mut() {
        last_req.response_body = Some(BASE64_STANDARD.encode(&body_bytes));
        last_req.response_headers = captured_headers;
    }
}
```

**Result**: Response body is only captured and returned when the check **fails**. For NEW-699, we need the response body from **successful** checks to analyze and suggest assertions.

### Data Flow

```
Sentry                          Uptime-Checker
------                          --------------
create_preview_check()  ──────► /execute_config
(checker_api.py)                     │
       │                             │
       │                      ReqwestChecker.check_url()
       │                             │
       │                      Body read if: assertion OR capture_on_failure
       │                             │
       │                      Body attached ONLY if: failure
       │                             │
invoke_checker_preview() ◄────── CheckResult (no body on success)
```

---

## Implementation: `always_capture_response` Flag (✅ Complete)

### Option A: Add `always_capture_response` Flag (Implemented)

**1. Uptime-Checker (Rust)**

Add new field to `CheckConfig`:

```rust
// src/types/check_config.rs
pub struct CheckConfig {
    // ... existing fields ...

    /// When true, always capture response body regardless of success/failure.
    /// Used for preview checks that need response data for assertion suggestions.
    #[serde(default)]
    pub always_capture_response: bool,
}
```

Modify `check_url()` to respect new flag:

```rust
// src/checker/reqwest_checker.rs
// Change line 559 from:
if should_capture && check_result.result == CheckStatus::Failure {
// To:
let should_attach = should_capture &&
    (check_result.result == CheckStatus::Failure || check.get_config().always_capture_response);
if should_attach {
```

**2. Sentry (Python)**

Update `create_preview_check()`:

```python
# src/sentry/uptime/checker_api.py
def create_preview_check(validated_data, region: UptimeRegionConfig) -> CheckConfig:
    config: CheckConfig = {
        # ... existing fields ...
        "always_capture_response": True,  # NEW: Enable for assertion suggestions
    }
    return config
```

### Option B: Always Return Body for `/execute_config`

Modify the uptime-checker's `/execute_config` endpoint to always include response body (preview-specific behavior). Less flexible but simpler.

---

## Next Steps

1. [x] ~~Set up Seer repo locally~~ ✅
2. [ ] **BLOCKED**: Verify Vertex AI access - Need GCP permissions (see "Blocked: GCP/Vertex AI Permissions" above)
3. [x] ~~Create uptime-checker PR~~ ✅ - Added `always_capture_response` flag (branch: `jaygoss/uptime-assertions-ai`)
4. [x] ~~Create Sentry PR~~ ✅ - Using new flag in preview checks (branch: `jaygoss/uptime-assertions-ai`)
5. [x] ~~Design the assertion suggestion prompt~~ ✅ - See `seer_assertions.py:build_assertion_prompt()`
6. [x] ~~Create API endpoint for suggestions~~ ✅ - `POST /api/0/organizations/{org}/uptime-assertion-suggestions/`
7. [x] ~~Frontend integration~~ ✅ - Added `AssertionSuggestionsButton` component with modal UI
8. [ ] Resolve GCP permissions issue (request IAM role or use different project)
9. [ ] Test end-to-end with working Vertex AI access
10. [ ] Create and merge PRs for uptime-checker and Sentry
11. [ ] Reach out in `#proj-seer-explorer` or `#discuss-seer-infra` for GCP access help

---

## ✅ Backend Implementation Complete

### New Files

| File                                                                       | Purpose                          |
| -------------------------------------------------------------------------- | -------------------------------- |
| `src/sentry/uptime/seer_assertions.py`                                     | Core module for Seer integration |
| `src/sentry/uptime/endpoints/organization_uptime_assertion_suggestions.py` | REST API endpoint                |

### API Endpoint

**URL**: `POST /api/0/organizations/{org_slug}/uptime-assertion-suggestions/`

**Request Body** (same as uptime-preview-check):

```json
{
  "url": "https://api.example.com/health",
  "timeout_ms": 5000,
  "request_method": "GET",
  "request_headers": [["Authorization", "Bearer token"]]
}
```

**Response**:

```json
{
  "preview_result": {
    "check_result": { ... },
    "assertions_enabled": true
  },
  "suggestions": [
    {
      "assertion_type": "status_code",
      "comparison": "equals",
      "expected_value": "200",
      "json_path": null,
      "header_name": null,
      "confidence": 0.95,
      "explanation": "Status code 200 indicates the endpoint is responding successfully",
      "assertion_json": {
        "op": "status_code_check",
        "value": 200,
        "operator": {"cmp": "equals"}
      }
    },
    {
      "assertion_type": "json_path",
      "comparison": "equals",
      "expected_value": "healthy",
      "json_path": "$.status",
      "header_name": null,
      "confidence": 0.85,
      "explanation": "The status field indicates service health",
      "assertion_json": {
        "op": "json_path",
        "value": "$.status",
        "operator": {"cmp": "equals"},
        "operand": {"jsonpath_op": "literal", "value": "healthy"}
      }
    }
  ],
  "suggested_assertion": {
    "root": {
      "op": "and",
      "children": [
        {"op": "status_code_check", "value": 200, "operator": {"cmp": "equals"}},
        {"op": "json_path", "value": "$.status", ...}
      ]
    }
  }
}
```

### Feature Flags Required

- `organizations:seer-explorer` - Enables Seer Explorer Client
- `organizations:uptime-runtime-assertions` - Enables uptime assertions

### Rate Limits

The endpoint has restrictive rate limits since it calls Seer:

- Per user: 1 request per 5 seconds, max 2 concurrent
- Per org: 10 requests per 60 seconds, max 5 concurrent

---

## ✅ Frontend Implementation Complete

### New Files

| File                                                                  | Purpose                              |
| --------------------------------------------------------------------- | ------------------------------------ |
| `static/app/views/alerts/rules/uptime/assertionSuggestionsButton.tsx` | Button component + suggestions modal |

### Types Added

In `static/app/views/alerts/rules/uptime/types.tsx`:

```typescript
interface AssertionSuggestion {
  assertion_json: Op;
  assertion_type: 'status_code' | 'json_path' | 'header';
  comparison: 'equals' | 'not_equal' | 'less_than' | 'greater_than';
  confidence: number;
  expected_value: string;
  explanation: string;
  header_name: string | null;
  json_path: string | null;
}

interface AssertionSuggestionsResponse {
  preview_result: PreviewCheckResponse;
  suggested_assertion: Assertion | null;
  suggestions: AssertionSuggestion[] | null;
}
```

### User Flow

1. User fills out uptime monitor form (URL, method, headers, etc.)
2. User clicks "Suggest Assertions" button
3. System runs preview check against URL
4. Seer analyzes response and generates suggestions
5. Modal displays suggestions with confidence scores and explanations
6. User can "Apply" individual suggestions or "Apply All"
7. Applied assertions appear in the form's assertion field

### Feature Flags Required

The "Suggest Assertions" button only appears when BOTH flags are enabled:

- `organizations:uptime-runtime-assertions` - Enables uptime assertions
- `organizations:seer-explorer` - Enables Seer Explorer Client

---

## Test Script

A test script is available at `scripts/test_seer_explorer.py` for validating Seer Explorer Client integration:

```bash
sentry django shell < scripts/test_seer_explorer.py
```

---

_Research conducted: January 2026_
_Last updated: January 31, 2026_
